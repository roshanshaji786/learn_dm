<?php
/**
 * Emails, reminders and WhatsApp message templates.
 *
 * @package DartsLMS
 */

defined( 'ABSPATH' ) || exit;

/**
 * Notifications.
 */
class DLMS_Notify {

	/**
	 * Init.
	 */
	public static function init() {
		add_action( 'tutor_after_enrolled', array( __CLASS__, 'enrolled' ), 30, 2 );
		add_action( 'dlms_cron_frequent', array( __CLASS__, 'class_reminders' ) );
		add_action( 'dlms_cron_daily', array( __CLASS__, 'due_reminders' ) );
	}

	/**
	 * Welcome email for a new account created by the admin.
	 *
	 * @param int $user_id   User.
	 * @param int $course_id Course.
	 */
	public static function welcome( $user_id, $course_id ) {
		$user = get_userdata( $user_id );
		if ( ! $user ) {
			return;
		}
		$key  = get_password_reset_key( $user );
		$set  = is_wp_error( $key ) ? wp_lostpassword_url() : network_site_url( 'wp-login.php?action=rp&key=' . $key . '&login=' . rawurlencode( $user->user_login ), 'login' );
		$body = '<p>' . sprintf( 'Hi %s,', esc_html( dlms_user_name( $user_id ) ) ) . '</p>'
			. '<p>' . sprintf( 'Welcome to <strong>%s</strong>! You are enrolled in <strong>%s</strong>.', esc_html( dlms_opt( 'academy_name' ) ), esc_html( get_the_title( $course_id ) ) ) . '</p>'
			. '<p>Your username is <strong>' . esc_html( $user->user_login ) . '</strong> (or use your email). Set your password here:</p>'
			. '<p>' . dlms_button( $set, 'Set my password' ) . '</p>'
			. '<p>After that, open your learning hub for class times, lessons, payments and certificates:</p>'
			. '<p><a href="' . esc_url( dlms_hub_url() ) . '">' . esc_html( dlms_hub_url() ) . '</a></p>';
		dlms_mail( $user_id, 'Welcome to ' . dlms_opt( 'academy_name' ), 'Welcome aboard!', $body );
	}

	/**
	 * Enrolment confirmation.
	 *
	 * @param int $course_id Course.
	 * @param int $user_id   User.
	 */
	public static function enrolled( $course_id, $user_id ) {
		if ( ! dlms_opt( 'notify_enrolled' ) ) {
			return;
		}
		$skip = 'dlms_skip_enrol_mail_' . $user_id . '_' . $course_id;
		if ( get_transient( $skip ) || get_user_meta( $user_id, '_dlms_bundle_' . $course_id, true ) ) {
			delete_transient( $skip );
			return;
		}
		$next = DLMS_Live::upcoming( array( $course_id ), 1 );
		$body = '<p>' . sprintf( 'Hi %s,', esc_html( dlms_user_name( $user_id ) ) ) . '</p>'
			. '<p>' . sprintf( 'You are enrolled in <strong>%s</strong>.', esc_html( get_the_title( $course_id ) ) ) . '</p>';
		if ( $next ) {
			$body .= '<p>' . sprintf( 'Your next live class: <strong>%s</strong> on %s.', esc_html( $next[0]['lesson']->post_title ), esc_html( dlms_date( $next[0]['start'] ) ) ) . '</p>';
		}
		$body .= '<p>' . dlms_button( get_permalink( $course_id ), 'Start learning' ) . '</p>';
		dlms_mail( $user_id, 'You are enrolled: ' . get_the_title( $course_id ), 'You are in!', $body );
	}

	/**
	 * Reminder emails before live classes (cron every 10 min).
	 */
	public static function class_reminders() {
		if ( ! dlms_opt( 'notify_class' ) || ! function_exists( 'tutor' ) ) {
			return;
		}
		$window = (int) dlms_opt( 'reminder_min' ) * MINUTE_IN_SECONDS;
		$q      = get_posts(
			array(
				'post_type'      => dlms_lesson_pt(),
				'posts_per_page' => 200,
				'post_status'    => 'publish',
				'meta_query'     => array( // phpcs:ignore WordPress.DB.SlowDBQuery
					array(
						'key'     => '_dlms_live_start',
						'value'   => array( wp_date( 'Y-m-d H:i', time() - HOUR_IN_SECONDS ), wp_date( 'Y-m-d H:i', time() + $window + HOUR_IN_SECONDS ) ),
						'compare' => 'BETWEEN',
						'type'    => 'CHAR',
					),
				),
			)
		);
		foreach ( $q as $lesson ) {
			$start = DLMS_Live::start_ts( $lesson->ID );
			if ( $start <= time() || $start - time() > $window ) {
				continue;
			}
			if ( (int) get_post_meta( $lesson->ID, '_dlms_reminder_sent', true ) === $start ) {
				continue;
			}
			update_post_meta( $lesson->ID, '_dlms_reminder_sent', $start );
			$course_id = dlms_lesson_course( $lesson->ID );
			foreach ( dlms_course_students( $course_id ) as $uid ) {
				if ( DLMS_Access::lock( $lesson->ID, $uid ) ) {
					continue;
				}
				$body = '<p>' . sprintf( 'Hi %s,', esc_html( dlms_user_name( $uid ) ) ) . '</p>'
					. '<p>' . sprintf( 'Your live class <strong>%s</strong> starts at <strong>%s</strong>.', esc_html( $lesson->post_title ), esc_html( dlms_date( $start, 'g:i A' ) ) ) . '</p>'
					. '<p>' . dlms_button( get_permalink( $lesson->ID ), 'Open the class page' ) . '</p>'
					. '<p style="color:#6b7280;font-size:13px">The Join button opens ' . (int) dlms_opt( 'join_before_min' ) . ' minutes before the class.</p>';
				dlms_mail( $uid, 'Starting soon: ' . $lesson->post_title, 'Class starts at ' . dlms_date( $start, 'g:i A' ), $body );
			}
		}
	}

	/**
	 * Fee due reminders (daily).
	 */
	public static function due_reminders() {
		if ( ! dlms_opt( 'notify_due' ) ) {
			return;
		}
		global $wpdb;
		$before = (int) dlms_opt( 'due_reminder_days' );
		$today  = dlms_today();
		foreach ( DLMS_DB::fees( array( 'only_due' => true ) ) as $f ) {
			if ( ! $f->due_date || $f->last_reminder === $today ) {
				continue;
			}
			$days_left = (int) floor( ( strtotime( $f->due_date ) - strtotime( $today ) ) / DAY_IN_SECONDS );
			// Remind N days before, on the day, and every 3 days once overdue.
			$send = ( $days_left === $before || 0 === $days_left || ( $days_left < 0 && 0 === abs( $days_left ) % 3 ) );
			if ( ! $send ) {
				continue;
			}
			$wpdb->update( DLMS_DB::t( 'fees' ), array( 'last_reminder' => $today ), array( 'id' => $f->id ) );
			$body = '<p>' . sprintf( 'Hi %s,', esc_html( dlms_user_name( $f->user_id ) ) ) . '</p>'
				. '<p>' . sprintf( 'A balance of <strong>%1$s</strong> for <strong>%2$s</strong> is due on <strong>%3$s</strong>.', esc_html( dlms_money( $f->balance ) ), esc_html( get_the_title( $f->course_id ) ), esc_html( mysql2date( 'j M Y', $f->due_date ) ) ) . '</p>'
				. ( $days_left < 0 ? '<p>Lessons are paused until the balance is paid.</p>' : '' )
				. ( dlms_opt( 'upi_id' ) ? '<p>UPI: <strong>' . esc_html( dlms_opt( 'upi_id' ) ) . '</strong></p>' : '' )
				. ( dlms_opt( 'whatsapp' ) ? '<p>After paying, send the screenshot on WhatsApp: ' . dlms_button( dlms_wa_link( dlms_opt( 'whatsapp' ), 'Hi, I paid ' . dlms_money( $f->balance ) . ' for ' . get_the_title( $f->course_id ) ), 'WhatsApp us' ) . '</p>' : '' );
			dlms_mail( $f->user_id, 'Fee reminder: ' . get_the_title( $f->course_id ), 'Payment reminder', $body );
		}
	}

	/**
	 * Assignment graded / returned.
	 *
	 * @param object $sub Submission.
	 */
	public static function graded( $sub ) {
		if ( ! dlms_opt( 'notify_graded' ) || ! $sub ) {
			return;
		}
		$lesson = get_the_title( $sub->lesson_id );
		$body   = '<p>' . sprintf( 'Hi %s,', esc_html( dlms_user_name( $sub->user_id ) ) ) . '</p>';
		if ( 'returned' === $sub->status ) {
			$body .= '<p>' . sprintf( 'Your assignment for <strong>%s</strong> needs a few changes. Please update and submit again.', esc_html( $lesson ) ) . '</p>';
		} else {
			$body .= '<p>' . sprintf( 'Your assignment for <strong>%1$s</strong> is marked: <strong>%2$s</strong>.', esc_html( $lesson ), esc_html( (float) $sub->marks . ( $sub->max_marks ? ' / ' . (float) $sub->max_marks : '' ) ) ) . '</p>';
		}
		if ( $sub->feedback ) {
			$body .= '<blockquote style="border-left:3px solid #ddd6fe;margin:0;padding:8px 12px;color:#374151">' . nl2br( esc_html( $sub->feedback ) ) . '</blockquote>';
		}
		$body .= '<p>' . dlms_button( get_permalink( $sub->lesson_id ) . '#dlms-assignment', 'View assignment' ) . '</p>';
		dlms_mail( $sub->user_id, ( 'returned' === $sub->status ? 'Please resubmit: ' : 'Marked: ' ) . $lesson, 'returned' === $sub->status ? 'Assignment returned' : 'Assignment marked', $body );
	}

	/**
	 * Certificate issued.
	 *
	 * @param object $c Certificate.
	 */
	public static function certificate( $c ) {
		if ( ! dlms_opt( 'notify_certificate' ) || ! $c ) {
			return;
		}
		$body = '<p>' . sprintf( 'Congratulations %s!', esc_html( $c->student_name ) ) . '</p>'
			. '<p>' . sprintf( 'You completed <strong>%s</strong>. Your certificate is ready.', esc_html( $c->course_name ) ) . '</p>'
			. '<p>' . dlms_button( DLMS_Certificates::download_url( $c->code ), 'Download certificate' ) . '</p>'
			. '<p>Certificate ID: <strong>' . esc_html( $c->code ) . '</strong><br>Anyone can verify it at <a href="' . esc_url( DLMS_Certificates::verify_url( $c->code ) ) . '">' . esc_html( DLMS_Certificates::verify_url( $c->code ) ) . '</a></p>';
		dlms_mail( $c->user_id, 'Your certificate: ' . $c->course_name, 'Certificate earned 🎉', $body );
	}

	/**
	 * Tell the admin about a new submission.
	 *
	 * @param int $lesson_id Lesson.
	 * @param int $user_id   User.
	 */
	public static function admin_new_submission( $lesson_id, $user_id ) {
		$to = dlms_opt( 'support_email' ) ? dlms_opt( 'support_email' ) : get_option( 'admin_email' );
		$body = '<p>' . sprintf( '%1$s submitted the assignment for <strong>%2$s</strong>.', esc_html( dlms_user_name( $user_id ) ), esc_html( get_the_title( $lesson_id ) ) ) . '</p>'
			. '<p>' . dlms_button( admin_url( 'admin.php?page=dlms-assignments&course=' . dlms_lesson_course( $lesson_id ) ), 'Mark it' ) . '</p>';
		dlms_mail( $to, 'New assignment: ' . get_the_title( $lesson_id ), 'New assignment submitted', $body );
	}

	/**
	 * WhatsApp text templates for the admin screens.
	 *
	 * @param string $type    due|class|welcome.
	 * @param array  $vars    Variables.
	 */
	public static function wa_text( $type, $vars ) {
		$name = $vars['name'] ?? '';
		switch ( $type ) {
			case 'due':
				return sprintf( "Hi %s, this is a reminder from %s. A balance of %s for %s is due on %s. UPI: %s. Please share the screenshot here after paying. Thank you!", $name, dlms_opt( 'academy_name' ), $vars['amount'] ?? '', $vars['course'] ?? '', $vars['date'] ?? '', dlms_opt( 'upi_id' ) );
			case 'class':
				return sprintf( "Hi %s, today's live class \"%s\" starts at %s. Join from here: %s", $name, $vars['lesson'] ?? '', $vars['time'] ?? '', $vars['url'] ?? '' );
			case 'welcome':
				return sprintf( "Hi %s, welcome to %s! You are enrolled in %s. Check your email (%s) to set your password, then open %s", $name, dlms_opt( 'academy_name' ), $vars['course'] ?? '', $vars['email'] ?? '', dlms_hub_url() );
		}
		return '';
	}
}
