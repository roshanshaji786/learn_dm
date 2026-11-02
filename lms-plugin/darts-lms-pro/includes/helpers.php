<?php
/**
 * Shared helpers.
 *
 * @package DartsLMS
 */

defined( 'ABSPATH' ) || exit;

/**
 * Default settings.
 */
function dlms_default_settings() {
	return array(
		'academy_name'       => 'Darts AI Academy',
		'signatory_name'     => 'Roshan Shaji',
		'signatory_title'    => 'Founder & Lead Trainer',
		'logo_url'           => '',
		'brand_color'        => '#6d28d9',
		'whatsapp'           => '917012045854',
		'upi_id'             => '',
		'support_email'      => get_option( 'admin_email' ),
		'receipt_prefix'     => 'DAA',
		'receipt_next'       => 2,
		'currency_symbol'    => '₹',
		'grace_days'         => 0,
		'join_before_min'    => 10,
		'reminder_min'       => 60,
		'due_reminder_days'  => 3,
		'google_client_id'   => '',
		'google_secret'      => '',
		'google_refresh'     => '',
		'google_email'       => '',
		'notify_welcome'     => 1,
		'notify_enrolled'    => 1,
		'notify_receipt'     => 1,
		'notify_class'       => 1,
		'notify_due'         => 1,
		'notify_graded'      => 1,
		'notify_certificate' => 1,
		'notify_new_lesson'  => 0,
		'protect_enabled'    => 1,
		'watermark_enabled'  => 1,
		'pwa_enabled'        => 1,
		'default_lang'       => 'en',
		'lang_switch'        => 1,
		'max_upload_mb'      => 10,
	);
}

/**
 * Get one setting or all.
 *
 * @param string|null $key Key.
 * @return mixed
 */
function dlms_opt( $key = null ) {
	static $cache = null;
	if ( null === $cache || 'refresh' === $key ) {
		$cache = wp_parse_args( (array) get_option( 'dlms_settings', array() ), dlms_default_settings() );
		if ( 'refresh' === $key ) {
			return $cache;
		}
	}
	if ( null === $key ) {
		return $cache;
	}
	return $cache[ $key ] ?? null;
}

/**
 * Update settings (merge).
 *
 * @param array $values Values.
 */
function dlms_update_opts( array $values ) {
	$all = wp_parse_args( $values, (array) get_option( 'dlms_settings', array() ) );
	update_option( 'dlms_settings', $all, false );
	dlms_opt( 'refresh' );
}

/**
 * Format money.
 *
 * @param float $amount Amount.
 */
function dlms_money( $amount ) {
	$amount = (float) $amount;
	$dec    = ( floor( $amount ) == $amount ) ? 0 : 2; // phpcs:ignore Universal.Operators.StrictComparisons
	return dlms_opt( 'currency_symbol' ) . number_format_i18n( $amount, $dec );
}

/**
 * Site-timezone "now" as timestamp.
 */
function dlms_now() {
	return time();
}

/**
 * Parse a local datetime string (Y-m-d H:i) in site timezone to a timestamp.
 *
 * @param string $local Local datetime.
 * @return int
 */
function dlms_local_to_ts( $local ) {
	if ( ! $local ) {
		return 0;
	}
	try {
		$dt = new DateTime( $local, wp_timezone() );
		return $dt->getTimestamp();
	} catch ( Exception $e ) {
		return 0;
	}
}

/**
 * Format a timestamp in site timezone.
 *
 * @param int    $ts     Timestamp.
 * @param string $format Format.
 */
function dlms_date( $ts, $format = 'D, j M Y · g:i A' ) {
	return $ts ? wp_date( $format, (int) $ts ) : '';
}

/**
 * Today (site timezone) as Y-m-d.
 */
function dlms_today() {
	return wp_date( 'Y-m-d' );
}

/**
 * Normalise an Indian phone number to wa.me format.
 *
 * @param string $phone Phone.
 */
function dlms_wa_number( $phone ) {
	$digits = preg_replace( '/\D+/', '', (string) $phone );
	if ( 10 === strlen( $digits ) ) {
		$digits = '91' . $digits;
	}
	return $digits;
}

/**
 * WhatsApp click-to-chat link.
 *
 * @param string $phone Phone.
 * @param string $text  Prefilled text.
 */
function dlms_wa_link( $phone, $text = '' ) {
	$num = dlms_wa_number( $phone );
	if ( ! $num ) {
		return '';
	}
	return 'https://wa.me/' . $num . ( $text ? '?text=' . rawurlencode( $text ) : '' );
}

/**
 * User phone.
 *
 * @param int $user_id User.
 */
function dlms_user_phone( $user_id ) {
	$phone = get_user_meta( $user_id, 'dlms_phone', true );
	if ( ! $phone ) {
		$phone = get_user_meta( $user_id, 'phone_number', true );
	}
	if ( ! $phone ) {
		$phone = get_user_meta( $user_id, 'billing_phone', true );
	}
	return $phone;
}

/**
 * Display name for a user.
 *
 * @param int $user_id User.
 */
function dlms_user_name( $user_id ) {
	$u = get_userdata( $user_id );
	if ( ! $u ) {
		return '';
	}
	$name = trim( $u->first_name . ' ' . $u->last_name );
	return $name ? $name : $u->display_name;
}

/**
 * Can current user manage the LMS (admins).
 */
function dlms_is_admin() {
	return current_user_can( 'manage_options' );
}

/**
* Can a user (default: current) manage a course (admin or one of its instructors).
 *
 * @param int $course_id Course.
 * @param int $user_id   User (0 = current).
 */
function dlms_can_manage_course( $course_id, $user_id = 0 ) {
	$uid = $user_id ? (int) $user_id : get_current_user_id();
	if ( ! $uid ) {
		return false;
	}
	if ( user_can( $uid, 'manage_options' ) ) {
		return true;
	}
	if ( ! $course_id ) {
		return false;
	}
	if ( (int) get_post_field( 'post_author', $course_id ) === $uid ) {
		return true;
	}
	$ids = get_user_meta( $uid, '_tutor_instructor_course_id' );
	return in_array( (int) $course_id, array_map( 'intval', (array) $ids ), true );
}

/**
 * Can the current user see the LMS admin screens at all.
 */
function dlms_can_teach() {
	return dlms_is_admin() || current_user_can( 'tutor_instructor' );
}

/**
 * Course post type.
 */
function dlms_course_pt() {
	return function_exists( 'tutor' ) ? tutor()->course_post_type : 'courses';
}

/**
 * Lesson post type.
 */
function dlms_lesson_pt() {
	return function_exists( 'tutor' ) ? tutor()->lesson_post_type : 'lesson';
}

/**
 * Courses the current user may manage.
 */
function dlms_manageable_courses() {
	$args = array(
		'post_type'      => dlms_course_pt(),
		'post_status'    => array( 'publish', 'draft', 'private', 'future', 'pending' ),
		'posts_per_page' => -1,
		'orderby'        => 'title',
		'order'          => 'ASC',
	);
	$all  = get_posts( $args );
	return array_values( array_filter( $all, fn( $c ) => dlms_can_manage_course( $c->ID ) ) );
}

/**
 * Ordered lessons of a course (topics in order, lessons in order).
 *
 * @param int  $course_id    Course.
 * @param bool $lessons_only Only lessons (exclude quizzes / tutor assignments).
 * @return WP_Post[]
 */
function dlms_course_lessons( $course_id, $lessons_only = true ) {
	$topics = get_posts(
		array(
			'post_type'      => 'topics',
			'post_parent'    => $course_id,
			'posts_per_page' => -1,
			'orderby'        => 'menu_order',
			'order'          => 'ASC',
			'post_status'    => 'any',
		)
	);
	$types  = $lessons_only ? array( dlms_lesson_pt() ) : array( dlms_lesson_pt(), 'tutor_quiz', 'tutor_assignments' );
	$out    = array();
	foreach ( $topics as $topic ) {
		$items = get_posts(
			array(
				'post_type'      => $types,
				'post_parent'    => $topic->ID,
				'posts_per_page' => -1,
				'orderby'        => 'menu_order',
				'order'          => 'ASC',
				'post_status'    => 'publish',
			)
		);
		foreach ( $items as $item ) {
			$item->dlms_topic = $topic->post_title;
			$out[]            = $item;
		}
	}
	return $out;
}

/**
 * Course id of a lesson.
 *
 * @param int $lesson_id Lesson.
 */
function dlms_lesson_course( $lesson_id ) {
	if ( function_exists( 'tutor_utils' ) ) {
		return (int) tutor_utils()->get_course_id_by_subcontent( $lesson_id );
	}
	$topic = (int) wp_get_post_parent_id( $lesson_id );
	return $topic ? (int) wp_get_post_parent_id( $topic ) : 0;
}

/**
 * Enrolment record (Tutor post) for user + course, completed only.
 *
 * @param int $course_id Course.
 * @param int $user_id   User.
 * @return WP_Post|null
 */
function dlms_get_enrolment( $course_id, $user_id ) {
	global $wpdb;
	$id = $wpdb->get_var(
		$wpdb->prepare(
			"SELECT ID FROM {$wpdb->posts} WHERE post_type = 'tutor_enrolled' AND post_parent = %d AND post_author = %d AND post_status = 'completed' ORDER BY ID DESC LIMIT 1",
			$course_id,
			$user_id
		)
	);
	return $id ? get_post( $id ) : null;
}

/**
 * Is user enrolled (completed) in course.
 *
 * @param int $course_id Course.
 * @param int $user_id   User.
 */
function dlms_is_enrolled( $course_id, $user_id ) {
	return (bool) dlms_get_enrolment( $course_id, $user_id );
}

/**
 * Enrol a user into a course with status completed (works for paid courses too).
 *
 * @param int $course_id Course.
 * @param int $user_id   User.
 * @return int Enrolment id.
 */
function dlms_enrol( $course_id, $user_id ) {
	$existing = dlms_get_enrolment( $course_id, $user_id );
	if ( $existing ) {
		return $existing->ID;
	}
	global $wpdb;
	// A pending one (from a failed checkout) gets completed.
	$pending = $wpdb->get_var(
		$wpdb->prepare(
			"SELECT ID FROM {$wpdb->posts} WHERE post_type = 'tutor_enrolled' AND post_parent = %d AND post_author = %d ORDER BY ID DESC LIMIT 1",
			$course_id,
			$user_id
		)
	);
	if ( ! $pending && class_exists( '\Tutor\Models\EnrollmentModel' ) ) {
		$pending = \Tutor\Models\EnrollmentModel::do_enroll( $course_id, 0, $user_id );
	}
	if ( ! $pending ) {
		$pending = wp_insert_post(
			array(
				'post_type'   => 'tutor_enrolled',
				'post_title'  => 'Course Enrolled – ' . gmdate( 'Y-m-d H:i' ),
				'post_status' => 'completed',
				'post_author' => $user_id,
				'post_parent' => $course_id,
			)
		);
		update_user_meta( $user_id, '_is_tutor_student', time() );
		do_action( 'tutor_after_enrolled', $course_id, $user_id, $pending );
		return (int) $pending;
	}
	if ( 'completed' !== get_post_status( $pending ) ) {
		if ( class_exists( '\Tutor\Models\EnrollmentModel' ) ) {
			\Tutor\Models\EnrollmentModel::update_enrollments( 'completed', array( (int) $pending ) );
		} else {
			wp_update_post(
				array(
					'ID'          => $pending,
					'post_status' => 'completed',
				)
			);
			do_action( 'tutor_after_enrolled', $course_id, $user_id, $pending );
		}
	}
	return (int) $pending;
}

/**
 * Users enrolled (completed) in a course.
 *
 * @param int $course_id Course.
 * @return int[]
 */
function dlms_course_students( $course_id ) {
	global $wpdb;
	return array_map(
		'intval',
		$wpdb->get_col(
			$wpdb->prepare(
				"SELECT DISTINCT post_author FROM {$wpdb->posts} WHERE post_type = 'tutor_enrolled' AND post_parent = %d AND post_status = 'completed'",
				$course_id
			)
		)
	);
}

/**
 * Course ids a user is enrolled in.
 *
 * @param int $user_id User.
 * @return int[]
 */
function dlms_user_courses( $user_id ) {
	global $wpdb;
	return array_map(
		'intval',
		$wpdb->get_col(
			$wpdb->prepare(
				"SELECT DISTINCT post_parent FROM {$wpdb->posts} WHERE post_type = 'tutor_enrolled' AND post_author = %d AND post_status = 'completed'",
				$user_id
			)
		)
	);
}

/**
 * Lesson meta getter with our prefix.
 *
 * @param int    $post_id Post.
 * @param string $key     Key without prefix.
 */
function dlms_meta( $post_id, $key ) {
	return get_post_meta( $post_id, '_dlms_' . $key, true );
}

/**
 * Wrap HTML in the branded email layout.
 *
 * @param string $title Title.
 * @param string $body  Body HTML.
 */
function dlms_email_wrap( $title, $body ) {
	$color = esc_attr( dlms_opt( 'brand_color' ) );
	$name  = esc_html( dlms_opt( 'academy_name' ) );
	$logo  = dlms_opt( 'logo_url' ) ? '<img src="' . esc_url( dlms_opt( 'logo_url' ) ) . '" alt="' . $name . '" style="max-height:48px">' : '<strong style="font-size:18px;color:' . $color . '">' . $name . '</strong>';
	$wa    = dlms_opt( 'whatsapp' ) ? ' · WhatsApp <a href="' . esc_url( dlms_wa_link( dlms_opt( 'whatsapp' ) ) ) . '">+' . esc_html( dlms_wa_number( dlms_opt( 'whatsapp' ) ) ) . '</a>' : '';
	return '<div style="background:#f5f3ff;padding:24px 12px;font-family:Arial,Helvetica,sans-serif;color:#1f2937">'
		. '<div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb">'
		. '<div style="padding:20px 24px;border-bottom:3px solid ' . $color . '">' . $logo . '</div>'
		. '<div style="padding:24px;font-size:15px;line-height:1.6"><h2 style="margin:0 0 12px;font-size:20px">' . esc_html( $title ) . '</h2>' . $body . '</div>'
		. '<div style="padding:16px 24px;background:#faf5ff;font-size:12px;color:#6b7280">' . $name . $wa . '</div>'
		. '</div></div>';
}

/**
 * Send a branded HTML email.
 *
 * @param string|int $to          Email or user id.
 * @param string     $subject     Subject.
 * @param string     $title       Heading.
 * @param string     $body        Body HTML.
 * @param array      $attachments Attachments.
 */
function dlms_mail( $to, $subject, $title, $body, $attachments = array() ) {
	if ( is_numeric( $to ) ) {
		$u  = get_userdata( (int) $to );
		$to = $u ? $u->user_email : '';
	}
	if ( ! $to || ! is_email( $to ) ) {
		return false;
	}
	$headers = array( 'Content-Type: text/html; charset=UTF-8' );
	return wp_mail( $to, $subject, dlms_email_wrap( $title, $body ), $headers, $attachments );
}

/**
 * A branded button for emails / pages.
 *
 * @param string $url   URL.
 * @param string $label Label.
 */
function dlms_button( $url, $label ) {
	return '<a href="' . esc_url( $url ) . '" style="display:inline-block;background:' . esc_attr( dlms_opt( 'brand_color' ) ) . ';color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px;font-weight:600">' . esc_html( $label ) . '</a>';
}

/**
 * Admin-post URL for a front action with nonce.
 *
 * @param string $action Action.
 * @param array  $args   Args.
 */
function dlms_action_url( $action, $args = array() ) {
	$args['action'] = 'dlms_' . $action;
	$args['_dlms']  = wp_create_nonce( 'dlms_' . $action );
	return add_query_arg( $args, admin_url( 'admin-post.php' ) );
}

/**
 * Verify a front action nonce or die.
 *
 * @param string $action Action.
 */
function dlms_check_action( $action ) {
	$nonce = isset( $_REQUEST['_dlms'] ) ? sanitize_text_field( wp_unslash( $_REQUEST['_dlms'] ) ) : '';
	if ( ! wp_verify_nonce( $nonce, 'dlms_' . $action ) ) {
		wp_die( esc_html__( 'This link has expired. Please go back and try again.', 'darts-lms' ), 403 );
	}
}

/**
 * Hub (student area) URL.
 */
function dlms_hub_url() {
	if ( function_exists( 'tutor_utils' ) ) {
		$url = tutor_utils()->tutor_dashboard_url( 'learning-hub' );
		if ( $url ) {
			return $url;
		}
	}
	$page = (int) get_option( 'dlms_hub_page' );
	return $page ? get_permalink( $page ) : home_url( '/' );
}

/**
 * Render HTML to PDF with Dompdf.
 *
 * @param string $html        HTML.
 * @param string $orientation portrait|landscape.
 * @return string PDF bytes ('' if Dompdf is missing).
 */
function dlms_pdf( $html, $orientation = 'portrait' ) {
	if ( ! class_exists( '\Dompdf\Dompdf' ) ) {
		return '';
	}
	$options = new \Dompdf\Options();
	$options->set( 'isRemoteEnabled', true );
	$options->set( 'defaultFont', 'DejaVu Sans' );
	$options->set( 'isHtml5ParserEnabled', true );
	$up = wp_upload_dir();
	$options->set( 'tempDir', get_temp_dir() );
	$options->set( 'fontCache', trailingslashit( $up['basedir'] ) . 'dlms-private' );
	$options->set( 'chroot', array( ABSPATH, DLMS_DIR, $up['basedir'] ) );
	$dompdf = new \Dompdf\Dompdf( $options );
	$dompdf->loadHtml( $html, 'UTF-8' );
	$dompdf->setPaper( 'A4', $orientation );
	$dompdf->render();
	return (string) $dompdf->output();
}

/**
 * Send PDF bytes to the browser and exit.
 *
 * @param string $pdf      Bytes.
 * @param string $filename File name.
 * @param bool   $inline   Show in browser instead of download.
 */
function dlms_send_pdf( $pdf, $filename, $inline = true ) {
	if ( '' === $pdf ) {
		wp_die( 'PDF library missing. Re-install the plugin zip that includes the vendor folder.' );
	}
	nocache_headers();
	header( 'Content-Type: application/pdf' );
	header( 'Content-Disposition: ' . ( $inline ? 'inline' : 'attachment' ) . '; filename="' . sanitize_file_name( $filename ) . '"' );
	header( 'Content-Length: ' . strlen( $pdf ) );
	echo $pdf; // phpcs:ignore WordPress.Security.EscapeOutput
	exit;
}

/**
 * Logo as a data URI for PDFs (avoids remote fetches), or ''.
 */
function dlms_logo_data_uri() {
	$url = dlms_opt( 'logo_url' );
	if ( ! $url ) {
		return '';
	}
	$up   = wp_upload_dir();
	$path = '';
	if ( 0 === strpos( $url, $up['baseurl'] ) ) {
		$path = $up['basedir'] . substr( $url, strlen( $up['baseurl'] ) );
	}
	if ( $path && file_exists( $path ) ) {
		$type = wp_check_filetype( $path );
		return 'data:' . ( $type['type'] ? $type['type'] : 'image/png' ) . ';base64,' . base64_encode( file_get_contents( $path ) ); // phpcs:ignore
	}
	return esc_url( $url );
}
