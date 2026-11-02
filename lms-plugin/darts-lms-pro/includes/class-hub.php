<?php
/**
 * Student "Learning Hub": live classes, payments, assignments, certificates.
 *
 * @package DartsLMS
 */

defined( 'ABSPATH' ) || exit;

/**
 * Hub.
 */
class DLMS_Hub {

	/**
	 * Init.
	 */
	public static function init() {
		add_shortcode( 'dlms_hub', array( __CLASS__, 'shortcode' ) );
		add_filter( 'tutor_dashboard/nav_items', array( __CLASS__, 'nav' ) );
		add_filter( 'load_dashboard_template_part_from_other_location', array( __CLASS__, 'template' ) );
	}

	/**
	 * Tutor dashboard menu item.
	 *
	 * @param array $items Items.
	 */
	public static function nav( $items ) {
		$new = array(
			'learning-hub' => array(
				'title'       => dlms_t( 'My Learning Hub' ),
				'icon'        => 'calendar-check',
				'active_icon' => 'calendar-2-fill',
			),
		);
		// Place right after "Home".
		$pos = array_search( 'index', array_keys( $items ), true );
		$pos = false === $pos ? 0 : $pos + 1;
		return array_slice( $items, 0, $pos, true ) + $new + array_slice( $items, $pos, null, true );
	}

	/**
	 * Load our template for the dashboard sub page.
	 *
	 * @param string $location Location.
	 */
	public static function template( $location ) {
		global $wp_query;
		if ( isset( $wp_query->query_vars['tutor_dashboard_page'] ) && 'learning-hub' === $wp_query->query_vars['tutor_dashboard_page'] ) {
			return DLMS_DIR . 'templates/dashboard-hub.php';
		}
		return $location;
	}

	/**
	 * Shortcode.
	 */
	public static function shortcode() {
		if ( ! is_user_logged_in() ) {
			return '<div class="dlms-hub"><p>' . esc_html( dlms_t( 'Please log in to see your learning hub.' ) ) . '</p><p><a class="dlms-btn" href="' . esc_url( wp_login_url( get_permalink() ) ) . '">' . esc_html( dlms_t( 'Log in' ) ) . '</a></p></div>';
		}
		return self::html( get_current_user_id() );
	}

	/**
	 * Relative day label.
	 *
	 * @param int $ts Timestamp.
	 */
	public static function day_label( $ts ) {
		$d = wp_date( 'Y-m-d', $ts );
		if ( dlms_today() === $d ) {
			return dlms_t( 'Today' ) . ', ' . wp_date( 'g:i A', $ts );
		}
		if ( wp_date( 'Y-m-d', time() + DAY_IN_SECONDS ) === $d ) {
			return dlms_t( 'Tomorrow' ) . ', ' . wp_date( 'g:i A', $ts );
		}
		return dlms_date( $ts );
	}

	/**
	 * Hub HTML for a user.
	 *
	 * @param int $uid User.
	 */
	public static function html( $uid ) {
		$courses = dlms_user_courses( $uid );
		$h       = '<div class="dlms-hub">';

		// Live classes.
		$h .= '<section class="dlms-card"><h2>' . esc_html( dlms_t( 'Upcoming live classes' ) ) . '</h2>';
		$up = DLMS_Live::upcoming( $courses, 6 );
		if ( $up ) {
			$h .= '<ul class="dlms-list">';
			foreach ( $up as $u ) {
				$l     = $u['lesson'];
				$state = DLMS_Live::state( $l->ID );
				$lock  = DLMS_Access::lock( $l->ID, $uid );
				$h    .= '<li><div><strong>' . esc_html( $l->post_title ) . '</strong><br><span class="dlms-muted">' . esc_html( get_the_title( $u['course'] ) ) . ' · ' . esc_html( self::day_label( $u['start'] ) ) . '</span></div>';
				if ( $lock ) {
					$h .= '<span class="dlms-pill dlms-pill-warn">🔒</span>';
				} elseif ( in_array( $state, array( 'open', 'live' ), true ) && dlms_meta( $l->ID, 'meet_link' ) ) {
					$h .= '<a class="dlms-btn dlms-btn-live" href="' . esc_url( DLMS_Live::join_url( $l->ID ) ) . '" target="_blank" rel="noopener">' . esc_html( dlms_t( 'Join live class' ) ) . '</a>';
				} else {
					$h .= '<a class="dlms-btn dlms-btn-ghost" href="' . esc_url( get_permalink( $l->ID ) ) . '">→</a>';
				}
				$h .= '</li>';
			}
			$h .= '</ul>';
		} else {
			$h .= '<p class="dlms-muted">' . esc_html( dlms_t( 'No upcoming live classes.' ) ) . '</p>';
		}
		$h .= '</section>';

		// Progress per course.
		if ( $courses ) {
			$h .= '<section class="dlms-card"><h2>' . esc_html( dlms_t( 'Progress' ) ) . '</h2><ul class="dlms-list">';
			foreach ( $courses as $cid ) {
				$pct  = (int) tutor_utils()->get_course_completed_percent( $cid, $uid );
				$att  = DLMS_Live::course_live_lessons( $cid ) ? DLMS_Reports::attendance_pct( $cid, $uid ) : null;
				$h   .= '<li><div style="flex:1"><a href="' . esc_url( get_permalink( $cid ) ) . '"><strong>' . esc_html( get_the_title( $cid ) ) . '</strong></a><div class="dlms-bar" role="progressbar" aria-valuenow="' . $pct . '" aria-valuemin="0" aria-valuemax="100"><span style="width:' . $pct . '%"></span></div><span class="dlms-muted">' . $pct . '%' . ( null !== $att ? ' · ' . esc_html( dlms_t( 'Attendance' ) ) . ' ' . $att . '%' : '' ) . '</span></div></li>';
			}
			$h .= '</ul></section>';
		}

		// Payments.
		$fees = DLMS_DB::fees( array( 'user_id' => $uid ) );
		$fees = array_filter( $fees, fn( $f ) => (float) $f->total_fee > 0 || (float) $f->paid > 0 );
		if ( $fees ) {
			$h .= '<section class="dlms-card"><h2>' . esc_html( dlms_t( 'My payments' ) ) . '</h2><div class="dlms-table-wrap"><table class="dlms-table"><thead><tr><th>' . esc_html( dlms_t( 'Course' ) ) . '</th><th>' . esc_html( dlms_t( 'Fee' ) ) . '</th><th>' . esc_html( dlms_t( 'Paid' ) ) . '</th><th>' . esc_html( dlms_t( 'Balance' ) ) . '</th><th>' . esc_html( dlms_t( 'Receipts' ) ) . '</th></tr></thead><tbody>';
			foreach ( $fees as $f ) {
				$receipts = array();
				foreach ( DLMS_DB::payments( $f->id ) as $p ) {
					if ( 'credit' !== $p->method ) {
						$receipts[] = '<a href="' . esc_url( DLMS_Payments::receipt_url( $p->id ) ) . '" target="_blank" rel="noopener">' . esc_html( $p->receipt_no ) . '</a>';
					}
				}
				$bal = $f->balance > 0 ? '<strong class="' . ( DLMS_DB::is_overdue( $f ) ? 'dlms-err' : '' ) . '">' . esc_html( dlms_money( $f->balance ) ) . '</strong>' . ( $f->due_date ? '<br><span class="dlms-muted">' . esc_html( dlms_t( 'Next due' ) ) . ': ' . esc_html( mysql2date( 'j M Y', $f->due_date ) ) . '</span>' : '' ) : '<span class="dlms-ok">' . esc_html( dlms_t( 'Fully paid' ) ) . '</span>';
				$h  .= '<tr><td>' . esc_html( get_the_title( $f->course_id ) ) . '</td><td>' . esc_html( dlms_money( $f->total_fee ) ) . '</td><td>' . esc_html( dlms_money( $f->paid ) ) . '</td><td>' . $bal . '</td><td>' . ( $receipts ? implode( '<br>', $receipts ) : '–' ) . '</td></tr>';
			}
			$h .= '</tbody></table></div>';
			if ( dlms_opt( 'upi_id' ) && array_filter( $fees, fn( $f ) => $f->balance > 0 ) ) {
				$h .= '<p class="dlms-muted">' . esc_html( dlms_t( 'Pay by UPI to' ) ) . ' <strong>' . esc_html( dlms_opt( 'upi_id' ) ) . '</strong></p>';
			}
			$h .= '</section>';
		}

		// Assignments.
		$rows = array();
		foreach ( $courses as $cid ) {
			foreach ( dlms_course_lessons( $cid ) as $l ) {
				if ( dlms_meta( $l->ID, 'has_assignment' ) && ! DLMS_Access::lock( $l->ID, $uid ) ) {
					$rows[] = array( $l, DLMS_DB::submission( $l->ID, $uid ) );
				}
			}
		}
		$h .= '<section class="dlms-card"><h2>' . esc_html( dlms_t( 'My assignments' ) ) . '</h2>';
		if ( $rows ) {
			$h .= '<ul class="dlms-list">';
			foreach ( $rows as $r ) {
				list( $l, $s ) = $r;
				if ( ! $s ) {
					$st = '<span class="dlms-pill dlms-pill-warn">' . esc_html( dlms_t( 'Not submitted' ) ) . '</span>';
				} elseif ( 'graded' === $s->status ) {
					$st = '<span class="dlms-pill dlms-pill-ok">' . esc_html( (float) $s->marks . ( $s->max_marks ? ' / ' . (float) $s->max_marks : '' ) ) . '</span>';
				} else {
					$st = '<span class="dlms-pill">' . esc_html( dlms_t( 'Waiting for marks' ) ) . '</span>';
				}
				$h .= '<li><a href="' . esc_url( get_permalink( $l->ID ) . '#dlms-assignment' ) . '">' . esc_html( $l->post_title ) . '</a>' . $st . '</li>';
			}
			$h .= '</ul>';
		} else {
			$h .= '<p class="dlms-muted">' . esc_html( dlms_t( 'No assignments yet.' ) ) . '</p>';
		}
		$h .= '</section>';

		// Certificates.
		$certs = array_filter( DLMS_DB::certificates( $uid ), fn( $c ) => ! $c->revoked );
		$h    .= '<section class="dlms-card"><h2>' . esc_html( dlms_t( 'My certificates' ) ) . '</h2>';
		if ( $certs ) {
			$h .= '<ul class="dlms-list">';
			foreach ( $certs as $c ) {
				$h .= '<li><div><strong>' . esc_html( $c->course_name ) . '</strong><br><span class="dlms-muted">' . esc_html( $c->code ) . ' · ' . esc_html( mysql2date( 'j M Y', $c->issued_at ) ) . '</span></div><span><a class="dlms-btn" href="' . esc_url( DLMS_Certificates::download_url( $c->code ) ) . '" target="_blank" rel="noopener">' . esc_html( dlms_t( 'Download' ) ) . '</a> <a class="dlms-link" href="' . esc_url( DLMS_Certificates::verify_url( $c->code ) ) . '">' . esc_html( dlms_t( 'Verify' ) ) . '</a></span></li>';
			}
			$h .= '</ul>';
		} else {
			$h .= '<p class="dlms-muted">' . esc_html( dlms_t( 'Finish a course to earn your certificate.' ) ) . '</p>';
		}
		$h .= '</section>';

		if ( dlms_opt( 'whatsapp' ) ) {
			$h .= '<p class="dlms-help"><a class="dlms-btn dlms-btn-wa" href="' . esc_url( dlms_wa_link( dlms_opt( 'whatsapp' ), 'Hi, I need help with my course.' ) ) . '" target="_blank" rel="noopener">' . esc_html( dlms_t( 'Need help? Message us on WhatsApp' ) ) . '</a></p>';
		}
		return $h . '</div>';
	}
}
