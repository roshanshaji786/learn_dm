<?php
/**
 * Gradebook, attendance % and CSV exports.
 *
 * @package DartsLMS
 */

defined( 'ABSPATH' ) || exit;

/**
 * Reports.
 */
class DLMS_Reports {

	/**
	 * Init.
	 */
	public static function init() {
		add_action( 'admin_post_dlms_export', array( __CLASS__, 'handle_export' ) );
	}

	/**
	 * Attendance % over past live classes.
	 *
	 * @param int $course_id Course.
	 * @param int $user_id   User.
	 */
	public static function attendance_pct( $course_id, $user_id ) {
		$past = 0;
		foreach ( DLMS_Live::course_live_lessons( $course_id ) as $l ) {
			if ( DLMS_Live::start_ts( $l->ID ) <= time() ) {
				++$past;
			}
		}
		if ( ! $past ) {
			return 100;
		}
		return (int) round( min( $past, DLMS_DB::attended_count( $course_id, $user_id ) ) * 100 / $past );
	}

	/**
	 * Average quiz % (best attempt per quiz).
	 *
	 * @param int $course_id Course.
	 * @param int $user_id   User.
	 * @return int|null
	 */
	public static function quiz_avg( $course_id, $user_id ) {
		global $wpdb;
		$rows = $wpdb->get_results(
			$wpdb->prepare(
				"SELECT quiz_id, MAX(earned_marks / NULLIF(total_marks,0)) AS pct FROM {$wpdb->prefix}tutor_quiz_attempts WHERE course_id = %d AND user_id = %d AND attempt_status = 'attempt_ended' GROUP BY quiz_id",
				$course_id,
				$user_id
			)
		);
		if ( ! $rows ) {
			return null;
		}
		$sum = 0;
		foreach ( $rows as $r ) {
			$sum += (float) $r->pct;
		}
		return (int) round( $sum * 100 / count( $rows ) );
	}

	/**
	 * Average assignment %.
	 *
	 * @param int $course_id Course.
	 * @param int $user_id   User.
	 * @return int|null
	 */
	public static function assignment_avg( $course_id, $user_id ) {
		$subs = DLMS_DB::submissions(
			array(
				'course_id' => $course_id,
				'user_id'   => $user_id,
				'status'    => 'graded',
			)
		);
		$subs = array_filter( $subs, fn( $s ) => (float) $s->max_marks > 0 );
		if ( ! $subs ) {
			return null;
		}
		$sum = 0;
		foreach ( $subs as $s ) {
			$sum += (float) $s->marks / (float) $s->max_marks;
		}
		return (int) round( $sum * 100 / count( $subs ) );
	}

	/**
	 * Gradebook rows for a course.
	 *
	 * @param int $course_id Course.
	 */
	public static function gradebook( $course_id ) {
		$assignment_lessons = array_filter( dlms_course_lessons( $course_id ), fn( $l ) => dlms_meta( $l->ID, 'has_assignment' ) );
		$rows               = array();
		foreach ( dlms_course_students( $course_id ) as $uid ) {
			$u   = get_userdata( $uid );
			$fee = DLMS_DB::fee( $uid, $course_id );
			$submitted = 0;
			foreach ( $assignment_lessons as $l ) {
				if ( DLMS_DB::submission( $l->ID, $uid ) ) {
					++$submitted;
				}
			}
			$cert   = DLMS_DB::certificate_for( $uid, $course_id );
			$rows[] = array(
				'user_id'     => $uid,
				'name'        => dlms_user_name( $uid ),
				'email'       => $u ? $u->user_email : '',
				'phone'       => dlms_user_phone( $uid ),
				'progress'    => (int) tutor_utils()->get_course_completed_percent( $course_id, $uid ),
				'quiz'        => self::quiz_avg( $course_id, $uid ),
				'assignments' => self::assignment_avg( $course_id, $uid ),
				'submitted'   => $submitted . '/' . count( $assignment_lessons ),
				'attendance'  => self::attendance_pct( $course_id, $uid ),
				'fee'         => $fee ? (float) $fee->total_fee : 0,
				'paid'        => $fee ? DLMS_DB::paid( $fee->id ) : 0,
				'balance'     => $fee ? DLMS_DB::balance( $fee ) : 0,
				'due'         => $fee && DLMS_DB::balance( $fee ) > 0 ? $fee->due_date : '',
				'certificate' => $cert && ! $cert->revoked ? $cert->code : '',
			);
		}
		usort( $rows, fn( $a, $b ) => strcasecmp( $a['name'], $b['name'] ) );
		return $rows;
	}

	/**
	 * Output a CSV and exit.
	 *
	 * @param string $filename File.
	 * @param array  $header   Header.
	 * @param array  $rows     Rows.
	 */
	public static function csv( $filename, $header, $rows ) {
		nocache_headers();
		header( 'Content-Type: text/csv; charset=utf-8' );
		header( 'Content-Disposition: attachment; filename="' . sanitize_file_name( $filename ) . '"' );
		$out = fopen( 'php://output', 'w' ); // phpcs:ignore WordPress.WP.AlternativeFunctions
		fwrite( $out, "\xEF\xBB\xBF" ); // phpcs:ignore WordPress.WP.AlternativeFunctions -- Excel UTF-8.
		fputcsv( $out, $header );
		foreach ( $rows as $r ) {
			// Stop spreadsheet formula injection.
			$r = array_map( fn( $v ) => is_string( $v ) && preg_match( '/^[=+\-@]/', $v ) ? "'" . $v : $v, array_values( $r ) );
			fputcsv( $out, $r );
		}
		fclose( $out ); // phpcs:ignore WordPress.WP.AlternativeFunctions
		exit;
	}

	/**
	 * CSV exports: gradebook, payments, attendance.
	 */
	public static function handle_export() {
		check_admin_referer( 'dlms_export' );
		$type      = sanitize_key( $_GET['type'] ?? 'gradebook' );
		$course_id = absint( $_GET['course'] ?? 0 );
		if ( $course_id ? ! dlms_can_manage_course( $course_id ) : ! dlms_is_admin() ) {
			wp_die( 'Not allowed', 403 );
		}
		$slug = $course_id ? sanitize_title( get_the_title( $course_id ) ) : 'all';
		if ( 'gradebook' === $type ) {
			$rows = self::gradebook( $course_id );
			self::csv( "gradebook-$slug.csv", array( 'User ID', 'Name', 'Email', 'Phone', 'Progress %', 'Quiz avg %', 'Assignment avg %', 'Assignments submitted', 'Attendance %', 'Fee', 'Paid', 'Balance', 'Due date', 'Certificate' ), $rows );
		}
		if ( 'payments' === $type ) {
			global $wpdb;
			$where = $course_id ? $wpdb->prepare( ' WHERE course_id = %d', $course_id ) : '';
			$list  = $wpdb->get_results( 'SELECT * FROM ' . DLMS_DB::t( 'payments' ) . $where . ' ORDER BY paid_at DESC' ); // phpcs:ignore WordPress.DB.PreparedSQL
			$rows  = array();
			foreach ( $list as $p ) {
				$rows[] = array( $p->receipt_no, $p->paid_at, dlms_user_name( $p->user_id ), dlms_user_phone( $p->user_id ), get_the_title( $p->course_id ), $p->amount, $p->method, $p->reference, $p->note );
			}
			self::csv( "payments-$slug.csv", array( 'Receipt', 'Paid at', 'Student', 'Phone', 'Course', 'Amount', 'Method', 'Reference', 'Note' ), $rows );
		}
		if ( 'attendance' === $type && $course_id ) {
			$lessons = DLMS_Live::course_live_lessons( $course_id );
			$header  = array( 'Student', 'Phone' );
			foreach ( $lessons as $l ) {
				$header[] = $l->post_title . ' (' . dlms_date( DLMS_Live::start_ts( $l->ID ), 'j M' ) . ')';
			}
			$header[] = 'Attendance %';
			$att      = array();
			foreach ( $lessons as $l ) {
				$att[ $l->ID ] = DLMS_DB::attendance_for_lesson( $l->ID );
			}
			$rows = array();
			foreach ( dlms_course_students( $course_id ) as $uid ) {
				$r = array( dlms_user_name( $uid ), dlms_user_phone( $uid ) );
				foreach ( $lessons as $l ) {
					$r[] = isset( $att[ $l->ID ][ $uid ] ) ? 'Present' : ( DLMS_Live::start_ts( $l->ID ) > time() ? '' : 'Absent' );
				}
				$r[]    = self::attendance_pct( $course_id, $uid );
				$rows[] = $r;
			}
			self::csv( "attendance-$slug.csv", $header, $rows );
		}
		wp_die( 'Unknown export.' );
	}

	/**
	 * Export URL.
	 *
	 * @param string $type      Type.
	 * @param int    $course_id Course.
	 */
	public static function export_url( $type, $course_id = 0 ) {
		return wp_nonce_url(
			add_query_arg(
				array(
					'action' => 'dlms_export',
					'type'   => $type,
					'course' => $course_id,
				),
				admin_url( 'admin-post.php' )
			),
			'dlms_export'
		);
	}

	/**
	 * Dashboard numbers.
	 */
	public static function overview() {
		global $wpdb;
		$p          = DLMS_DB::t( 'payments' );
		$month      = wp_date( 'Y-m-01 00:00:00' );
		$fees       = DLMS_DB::fees();
		$due_total  = 0;
		$overdue    = array();
		$due_soon   = array();
		foreach ( $fees as $f ) {
			if ( $f->balance <= 0 ) {
				continue;
			}
			$due_total += $f->balance;
			if ( DLMS_DB::is_overdue( $f ) ) {
				$overdue[] = $f;
			} elseif ( $f->due_date && $f->due_date <= wp_date( 'Y-m-d', time() + 7 * DAY_IN_SECONDS ) ) {
				$due_soon[] = $f;
			}
		}
		$all_courses = get_posts(
			array(
				'post_type'      => dlms_course_pt(),
				'posts_per_page' => -1,
				'fields'         => 'ids',
				'post_status'    => 'any',
			)
		);
		$today       = array();
		$day_start   = dlms_local_to_ts( dlms_today() . ' 00:00' );
		foreach ( DLMS_Live::upcoming( $all_courses, 50 ) as $u ) {
			if ( $u['start'] < $day_start + 2 * DAY_IN_SECONDS ) {
				$today[] = $u;
			}
		}
		return array(
			'revenue_month' => (float) $wpdb->get_var( $wpdb->prepare( "SELECT COALESCE(SUM(amount),0) FROM $p WHERE method <> 'credit' AND paid_at >= %s", $month ) ), // phpcs:ignore WordPress.DB.PreparedSQL
			'revenue_all'   => (float) $wpdb->get_var( "SELECT COALESCE(SUM(amount),0) FROM $p WHERE method <> 'credit'" ), // phpcs:ignore WordPress.DB.PreparedSQL
			'due_total'     => $due_total,
			'students'      => (int) $wpdb->get_var( "SELECT COUNT(DISTINCT post_author) FROM {$wpdb->posts} WHERE post_type = 'tutor_enrolled' AND post_status = 'completed'" ),
			'to_grade'      => count( DLMS_DB::submissions( array( 'status' => 'submitted' ) ) ),
			'overdue'       => $overdue,
			'due_soon'      => $due_soon,
			'classes'       => $today,
			'recent'        => $wpdb->get_results( "SELECT * FROM $p ORDER BY id DESC LIMIT 8" ), // phpcs:ignore WordPress.DB.PreparedSQL
		);
	}
}
