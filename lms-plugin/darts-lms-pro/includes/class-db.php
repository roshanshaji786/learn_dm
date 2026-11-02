<?php
/**
 * Database tables, activation and data access.
 *
 * @package DartsLMS
 */

defined( 'ABSPATH' ) || exit;

/**
 * DB layer.
 */
class DLMS_DB {

	/**
	 * Table name.
	 *
	 * @param string $name Short name.
	 */
	public static function t( $name ) {
		global $wpdb;
		return $wpdb->prefix . 'dlms_' . $name;
	}

	/**
	 * Activation.
	 */
	public static function activate() {
		self::create_tables();
		if ( ! get_option( 'dlms_settings' ) ) {
			update_option( 'dlms_settings', dlms_default_settings(), false );
		}
		self::create_pages();
		self::private_dir();
		if ( ! wp_next_scheduled( 'dlms_cron_frequent' ) ) {
			wp_schedule_event( time() + 60, 'dlms_ten_minutes', 'dlms_cron_frequent' );
		}
		if ( ! wp_next_scheduled( 'dlms_cron_daily' ) ) {
			$first = dlms_local_to_ts( wp_date( 'Y-m-d' ) . ' 09:00' );
			if ( $first < time() ) {
				$first += DAY_IN_SECONDS;
			}
			wp_schedule_event( $first, 'daily', 'dlms_cron_daily' );
		}
		update_option( 'dlms_flush_rewrite', 1 );
	}

	/**
	 * Deactivation.
	 */
	public static function deactivate() {
		wp_clear_scheduled_hook( 'dlms_cron_frequent' );
		wp_clear_scheduled_hook( 'dlms_cron_daily' );
		flush_rewrite_rules();
	}

	/**
	 * Upgrade check.
	 */
	public static function maybe_upgrade() {
		if ( get_option( 'dlms_db_version' ) !== DLMS_DB_VERSION ) {
			self::create_tables();
			self::private_dir();
		}
		if ( get_option( 'dlms_flush_rewrite' ) ) {
			add_action(
				'init',
				function () {
					flush_rewrite_rules();
					delete_option( 'dlms_flush_rewrite' );
				},
				999
			);
		}
	}

	/**
	 * Create / update tables.
	 */
	public static function create_tables() {
		global $wpdb;
		require_once ABSPATH . 'wp-admin/includes/upgrade.php';
		$c = $wpdb->get_charset_collate();

		dbDelta(
			'CREATE TABLE ' . self::t( 'fees' ) . " (
			id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
			user_id bigint(20) unsigned NOT NULL,
			course_id bigint(20) unsigned NOT NULL,
			total_fee decimal(12,2) NOT NULL DEFAULT 0,
			due_date date DEFAULT NULL,
			plan_note varchar(255) NOT NULL DEFAULT '',
			last_reminder date DEFAULT NULL,
			created_at datetime NOT NULL,
			PRIMARY KEY  (id),
			UNIQUE KEY user_course (user_id,course_id),
			KEY course_id (course_id)
		) $c;"
		);

		dbDelta(
			'CREATE TABLE ' . self::t( 'payments' ) . " (
			id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
			fee_id bigint(20) unsigned NOT NULL,
			user_id bigint(20) unsigned NOT NULL,
			course_id bigint(20) unsigned NOT NULL,
			amount decimal(12,2) NOT NULL DEFAULT 0,
			method varchar(30) NOT NULL DEFAULT 'upi',
			reference varchar(191) NOT NULL DEFAULT '',
			receipt_no varchar(60) NOT NULL DEFAULT '',
			note varchar(255) NOT NULL DEFAULT '',
			paid_at datetime NOT NULL,
			created_by bigint(20) unsigned NOT NULL DEFAULT 0,
			PRIMARY KEY  (id),
			KEY fee_id (fee_id),
			KEY user_id (user_id),
			KEY reference (reference)
		) $c;"
		);

		dbDelta(
			'CREATE TABLE ' . self::t( 'attendance' ) . " (
			id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
			lesson_id bigint(20) unsigned NOT NULL,
			course_id bigint(20) unsigned NOT NULL,
			user_id bigint(20) unsigned NOT NULL,
			source varchar(20) NOT NULL DEFAULT 'auto',
			joined_at datetime NOT NULL,
			PRIMARY KEY  (id),
			UNIQUE KEY lesson_user (lesson_id,user_id),
			KEY course_id (course_id)
		) $c;"
		);

		dbDelta(
			'CREATE TABLE ' . self::t( 'submissions' ) . " (
			id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
			lesson_id bigint(20) unsigned NOT NULL,
			course_id bigint(20) unsigned NOT NULL,
			user_id bigint(20) unsigned NOT NULL,
			answer longtext NULL,
			link varchar(500) NOT NULL DEFAULT '',
			file_path varchar(500) NOT NULL DEFAULT '',
			file_name varchar(255) NOT NULL DEFAULT '',
			status varchar(20) NOT NULL DEFAULT 'submitted',
			marks decimal(8,2) DEFAULT NULL,
			max_marks decimal(8,2) DEFAULT NULL,
			feedback text NULL,
			submitted_at datetime NOT NULL,
			graded_at datetime DEFAULT NULL,
			graded_by bigint(20) unsigned NOT NULL DEFAULT 0,
			PRIMARY KEY  (id),
			UNIQUE KEY lesson_user (lesson_id,user_id),
			KEY course_id (course_id)
		) $c;"
		);

		dbDelta(
			'CREATE TABLE ' . self::t( 'certificates' ) . " (
			id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
			code varchar(40) NOT NULL,
			user_id bigint(20) unsigned NOT NULL,
			course_id bigint(20) unsigned NOT NULL,
			student_name varchar(191) NOT NULL DEFAULT '',
			course_name varchar(255) NOT NULL DEFAULT '',
			issued_at datetime NOT NULL,
			revoked tinyint(1) NOT NULL DEFAULT 0,
			PRIMARY KEY  (id),
			UNIQUE KEY code (code),
			UNIQUE KEY user_course (user_id,course_id)
		) $c;"
		);

		update_option( 'dlms_db_version', DLMS_DB_VERSION );
	}

	/**
	 * Pages used by the plugin.
	 */
	public static function create_pages() {
		$pages = array(
			'dlms_verify_page' => array( 'Verify Certificate', '[dlms_verify]', 'verify-certificate' ),
			'dlms_hub_page'    => array( 'My Learning Hub', '[dlms_hub]', 'learning-hub' ),
		);
		foreach ( $pages as $opt => $p ) {
			$id = (int) get_option( $opt );
			if ( $id && get_post( $id ) && 'trash' !== get_post_status( $id ) ) {
				continue;
			}
			$id = wp_insert_post(
				array(
					'post_type'    => 'page',
					'post_status'  => 'publish',
					'post_title'   => $p[0],
					'post_content' => $p[1],
					'post_name'    => $p[2],
				)
			);
			if ( $id && ! is_wp_error( $id ) ) {
				update_option( $opt, $id );
			}
		}
	}

	/**
	 * Private uploads dir (denied from the web).
	 */
	public static function private_dir() {
		$up  = wp_upload_dir();
		$dir = trailingslashit( $up['basedir'] ) . 'dlms-private';
		if ( ! is_dir( $dir ) ) {
			wp_mkdir_p( $dir );
		}
		if ( ! file_exists( $dir . '/.htaccess' ) ) {
			file_put_contents( $dir . '/.htaccess', "Require all denied\nDeny from all\n" ); // phpcs:ignore WordPress.WP.AlternativeFunctions
		}
		if ( ! file_exists( $dir . '/index.php' ) ) {
			file_put_contents( $dir . '/index.php', "<?php // Silence.\n" ); // phpcs:ignore WordPress.WP.AlternativeFunctions
		}
		return $dir;
	}

	/* ---------- Fees and payments ---------- */

	/**
	 * Fee row for user + course.
	 *
	 * @param int $user_id   User.
	 * @param int $course_id Course.
	 */
	public static function fee( $user_id, $course_id ) {
		global $wpdb;
		return $wpdb->get_row( $wpdb->prepare( 'SELECT * FROM ' . self::t( 'fees' ) . ' WHERE user_id = %d AND course_id = %d', $user_id, $course_id ) ); // phpcs:ignore WordPress.DB.PreparedSQL
	}

	/**
	 * Fee row by id.
	 *
	 * @param int $id Id.
	 */
	public static function fee_by_id( $id ) {
		global $wpdb;
		return $wpdb->get_row( $wpdb->prepare( 'SELECT * FROM ' . self::t( 'fees' ) . ' WHERE id = %d', $id ) ); // phpcs:ignore WordPress.DB.PreparedSQL
	}

	/**
	 * Create or update the fee plan.
	 *
	 * @param int         $user_id   User.
	 * @param int         $course_id Course.
	 * @param float       $total     Total fee.
	 * @param string|null $due       Next due date (Y-m-d) or null.
	 * @param string      $note      Plan note.
	 * @return int Fee id.
	 */
	public static function save_fee( $user_id, $course_id, $total, $due = null, $note = '' ) {
		global $wpdb;
		$row  = self::fee( $user_id, $course_id );
		$data = array(
			'total_fee' => (float) $total,
			'due_date'  => $due ? $due : null,
			'plan_note' => (string) $note,
		);
		if ( $row ) {
			$wpdb->update( self::t( 'fees' ), $data, array( 'id' => $row->id ) );
			return (int) $row->id;
		}
		$data['user_id']    = $user_id;
		$data['course_id']  = $course_id;
		$data['created_at'] = current_time( 'mysql' );
		$wpdb->insert( self::t( 'fees' ), $data );
		return (int) $wpdb->insert_id;
	}

	/**
	 * Sum paid for a fee row.
	 *
	 * @param int $fee_id Fee id.
	 */
	public static function paid( $fee_id ) {
		global $wpdb;
		return (float) $wpdb->get_var( $wpdb->prepare( 'SELECT COALESCE(SUM(amount),0) FROM ' . self::t( 'payments' ) . ' WHERE fee_id = %d', $fee_id ) ); // phpcs:ignore WordPress.DB.PreparedSQL
	}

	/**
	 * Balance for a fee row.
	 *
	 * @param object $fee Fee row.
	 */
	public static function balance( $fee ) {
		return max( 0, round( (float) $fee->total_fee - self::paid( $fee->id ), 2 ) );
	}

	/**
	 * Payments of a fee row.
	 *
	 * @param int $fee_id Fee id.
	 */
	public static function payments( $fee_id ) {
		global $wpdb;
		return $wpdb->get_results( $wpdb->prepare( 'SELECT * FROM ' . self::t( 'payments' ) . ' WHERE fee_id = %d ORDER BY paid_at ASC, id ASC', $fee_id ) ); // phpcs:ignore WordPress.DB.PreparedSQL
	}

	/**
	 * One payment.
	 *
	 * @param int $id Id.
	 */
	public static function payment( $id ) {
		global $wpdb;
		return $wpdb->get_row( $wpdb->prepare( 'SELECT * FROM ' . self::t( 'payments' ) . ' WHERE id = %d', $id ) ); // phpcs:ignore WordPress.DB.PreparedSQL
	}

	/**
	 * Next receipt number, e.g. DAA-2026-002.
	 */
	public static function next_receipt_no() {
		$n      = max( 1, (int) dlms_opt( 'receipt_next' ) );
		$prefix = sanitize_text_field( dlms_opt( 'receipt_prefix' ) );
		dlms_update_opts( array( 'receipt_next' => $n + 1 ) );
		return $prefix . '-' . wp_date( 'Y' ) . '-' . str_pad( (string) $n, 3, '0', STR_PAD_LEFT );
	}

	/**
	 * Record a payment.
	 *
	 * @param int    $fee_id    Fee id.
	 * @param float  $amount    Amount.
	 * @param string $method    Method.
	 * @param string $reference Reference.
	 * @param string $note      Note.
	 * @param string $paid_at   Datetime (local mysql) or ''.
	 * @return int Payment id.
	 */
	public static function add_payment( $fee_id, $amount, $method = 'upi', $reference = '', $note = '', $paid_at = '' ) {
		global $wpdb;
		$fee = self::fee_by_id( $fee_id );
		if ( ! $fee || $amount <= 0 ) {
			return 0;
		}
		$wpdb->insert(
			self::t( 'payments' ),
			array(
				'fee_id'     => $fee->id,
				'user_id'    => $fee->user_id,
				'course_id'  => $fee->course_id,
				'amount'     => (float) $amount,
				'method'     => sanitize_key( $method ),
				'reference'  => (string) $reference,
				'receipt_no' => 'credit' === $method ? '' : self::next_receipt_no(),
				'note'       => (string) $note,
				'paid_at'    => $paid_at ? $paid_at : current_time( 'mysql' ),
				'created_by' => get_current_user_id(),
			)
		);
		$id = (int) $wpdb->insert_id;
		if ( $id ) {
			do_action( 'dlms_payment_added', $id, $fee );
		}
		return $id;
	}

	/**
	 * Delete a payment.
	 *
	 * @param int $id Id.
	 */
	public static function delete_payment( $id ) {
		global $wpdb;
		return $wpdb->delete( self::t( 'payments' ), array( 'id' => $id ) );
	}

	/**
	 * All fee rows with balance info.
	 *
	 * @param array $args course_id, user_id, only_due.
	 */
	public static function fees( $args = array() ) {
		global $wpdb;
		$where = array( '1=1' );
		if ( ! empty( $args['course_id'] ) ) {
			$where[] = $wpdb->prepare( 'f.course_id = %d', $args['course_id'] );
		}
		if ( ! empty( $args['user_id'] ) ) {
			$where[] = $wpdb->prepare( 'f.user_id = %d', $args['user_id'] );
		}
		$sql  = 'SELECT f.*, COALESCE((SELECT SUM(p.amount) FROM ' . self::t( 'payments' ) . ' p WHERE p.fee_id = f.id),0) AS paid FROM ' . self::t( 'fees' ) . ' f WHERE ' . implode( ' AND ', $where ) . ' ORDER BY f.created_at DESC';
		$rows = $wpdb->get_results( $sql ); // phpcs:ignore WordPress.DB.PreparedSQL
		foreach ( $rows as $r ) {
			$r->balance = max( 0, round( (float) $r->total_fee - (float) $r->paid, 2 ) );
		}
		if ( ! empty( $args['only_due'] ) ) {
			$rows = array_values( array_filter( $rows, fn( $r ) => $r->balance > 0 ) );
		}
		return $rows;
	}

	/**
	 * Is a fee row overdue (balance left and due date passed + grace).
	 *
	 * @param object $fee Fee row.
	 */
	public static function is_overdue( $fee ) {
		if ( ! $fee || ! $fee->due_date ) {
			return false;
		}
		if ( self::balance( $fee ) <= 0 ) {
			return false;
		}
		$grace = (int) dlms_opt( 'grace_days' );
		$limit = gmdate( 'Y-m-d', strtotime( $fee->due_date . ' +' . $grace . ' days' ) );
		return dlms_today() > $limit;
	}

	/* ---------- Attendance ---------- */

	/**
	 * Mark attendance.
	 *
	 * @param int    $lesson_id Lesson.
	 * @param int    $user_id   User.
	 * @param string $source    auto|manual.
	 */
	public static function mark_attendance( $lesson_id, $user_id, $source = 'auto' ) {
		global $wpdb;
		$table = self::t( 'attendance' );
		$exists = $wpdb->get_var( $wpdb->prepare( "SELECT id FROM $table WHERE lesson_id = %d AND user_id = %d", $lesson_id, $user_id ) ); // phpcs:ignore WordPress.DB.PreparedSQL
		if ( $exists ) {
			return (int) $exists;
		}
		$wpdb->insert(
			$table,
			array(
				'lesson_id' => $lesson_id,
				'course_id' => dlms_lesson_course( $lesson_id ),
				'user_id'   => $user_id,
				'source'    => $source,
				'joined_at' => current_time( 'mysql' ),
			)
		);
		return (int) $wpdb->insert_id;
	}

	/**
	 * Remove attendance.
	 *
	 * @param int $lesson_id Lesson.
	 * @param int $user_id   User.
	 */
	public static function unmark_attendance( $lesson_id, $user_id ) {
		global $wpdb;
		return $wpdb->delete(
			self::t( 'attendance' ),
			array(
				'lesson_id' => $lesson_id,
				'user_id'   => $user_id,
			)
		);
	}

	/**
	 * Attendance rows for a lesson keyed by user.
	 *
	 * @param int $lesson_id Lesson.
	 */
	public static function attendance_for_lesson( $lesson_id ) {
		global $wpdb;
		$rows = $wpdb->get_results( $wpdb->prepare( 'SELECT * FROM ' . self::t( 'attendance' ) . ' WHERE lesson_id = %d', $lesson_id ) ); // phpcs:ignore WordPress.DB.PreparedSQL
		$out  = array();
		foreach ( $rows as $r ) {
			$out[ (int) $r->user_id ] = $r;
		}
		return $out;
	}

	/**
	 * Count of classes a user attended in a course.
	 *
	 * @param int $course_id Course.
	 * @param int $user_id   User.
	 */
	public static function attended_count( $course_id, $user_id ) {
		global $wpdb;
		return (int) $wpdb->get_var( $wpdb->prepare( 'SELECT COUNT(*) FROM ' . self::t( 'attendance' ) . ' WHERE course_id = %d AND user_id = %d', $course_id, $user_id ) ); // phpcs:ignore WordPress.DB.PreparedSQL
	}

	/* ---------- Submissions ---------- */

	/**
	 * Submission for lesson + user.
	 *
	 * @param int $lesson_id Lesson.
	 * @param int $user_id   User.
	 */
	public static function submission( $lesson_id, $user_id ) {
		global $wpdb;
		return $wpdb->get_row( $wpdb->prepare( 'SELECT * FROM ' . self::t( 'submissions' ) . ' WHERE lesson_id = %d AND user_id = %d', $lesson_id, $user_id ) ); // phpcs:ignore WordPress.DB.PreparedSQL
	}

	/**
	 * Submission by id.
	 *
	 * @param int $id Id.
	 */
	public static function submission_by_id( $id ) {
		global $wpdb;
		return $wpdb->get_row( $wpdb->prepare( 'SELECT * FROM ' . self::t( 'submissions' ) . ' WHERE id = %d', $id ) ); // phpcs:ignore WordPress.DB.PreparedSQL
	}

	/**
	 * Submissions list.
	 *
	 * @param array $args course_id, status, user_id.
	 */
	public static function submissions( $args = array() ) {
		global $wpdb;
		$where = array( '1=1' );
		if ( ! empty( $args['course_id'] ) ) {
			$where[] = $wpdb->prepare( 'course_id = %d', $args['course_id'] );
		}
		if ( ! empty( $args['course_ids'] ) ) {
			$where[] = 'course_id IN (' . implode( ',', array_map( 'intval', $args['course_ids'] ) ) . ')';
		}
		if ( ! empty( $args['status'] ) ) {
			$where[] = $wpdb->prepare( 'status = %s', $args['status'] );
		}
		if ( ! empty( $args['user_id'] ) ) {
			$where[] = $wpdb->prepare( 'user_id = %d', $args['user_id'] );
		}
		return $wpdb->get_results( 'SELECT * FROM ' . self::t( 'submissions' ) . ' WHERE ' . implode( ' AND ', $where ) . ' ORDER BY submitted_at DESC' ); // phpcs:ignore WordPress.DB.PreparedSQL
	}

	/* ---------- Certificates ---------- */

	/**
	 * Certificate by code.
	 *
	 * @param string $code Code.
	 */
	public static function certificate( $code ) {
		global $wpdb;
		return $wpdb->get_row( $wpdb->prepare( 'SELECT * FROM ' . self::t( 'certificates' ) . ' WHERE code = %s', $code ) ); // phpcs:ignore WordPress.DB.PreparedSQL
	}

	/**
	 * Certificate for user + course.
	 *
	 * @param int $user_id   User.
	 * @param int $course_id Course.
	 */
	public static function certificate_for( $user_id, $course_id ) {
		global $wpdb;
		return $wpdb->get_row( $wpdb->prepare( 'SELECT * FROM ' . self::t( 'certificates' ) . ' WHERE user_id = %d AND course_id = %d', $user_id, $course_id ) ); // phpcs:ignore WordPress.DB.PreparedSQL
	}

	/**
	 * Certificates list.
	 *
	 * @param int $user_id Optional user filter.
	 */
	public static function certificates( $user_id = 0 ) {
		global $wpdb;
		if ( $user_id ) {
			return $wpdb->get_results( $wpdb->prepare( 'SELECT * FROM ' . self::t( 'certificates' ) . ' WHERE user_id = %d ORDER BY issued_at DESC', $user_id ) ); // phpcs:ignore WordPress.DB.PreparedSQL
		}
		return $wpdb->get_results( 'SELECT * FROM ' . self::t( 'certificates' ) . ' ORDER BY issued_at DESC' ); // phpcs:ignore WordPress.DB.PreparedSQL
	}
}

add_filter(
	'cron_schedules',
	function ( $s ) {
		$s['dlms_ten_minutes'] = array(
			'interval' => 600,
			'display'  => 'Every 10 minutes (Darts LMS)',
		);
		return $s;
	}
);
