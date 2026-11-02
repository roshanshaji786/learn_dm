<?php
/**
 * Admin screens.
 *
 * @package DartsLMS
 */

defined( 'ABSPATH' ) || exit;

/**
 * Admin.
 */
class DLMS_Admin {

	/**
	 * Init.
	 */
	public static function init() {
		add_action( 'admin_menu', array( __CLASS__, 'menu' ) );
		add_action( 'admin_enqueue_scripts', array( __CLASS__, 'assets' ) );
		add_action( 'admin_post_dlms_save_course', array( __CLASS__, 'save_course' ) );
		add_action( 'admin_post_dlms_save_settings', array( __CLASS__, 'save_settings' ) );
		add_filter( 'plugin_action_links_' . plugin_basename( DLMS_FILE ), array( __CLASS__, 'links' ) );
	}

	/**
	 * Plugin list links.
	 *
	 * @param array $l Links.
	 */
	public static function links( $l ) {
		array_unshift( $l, '<a href="' . esc_url( admin_url( 'admin.php?page=dlms-settings' ) ) . '">Settings</a>' );
		return $l;
	}

	/**
	 * Menu.
	 */
	public static function menu() {
		if ( ! dlms_can_teach() ) {
			return;
		}
		$cap = 'read';
		add_menu_page( 'Darts LMS', 'Darts LMS', $cap, 'dlms', array( __CLASS__, 'page_dashboard' ), 'dashicons-welcome-learn-more', 3 );
		add_submenu_page( 'dlms', 'Dashboard', 'Dashboard', $cap, 'dlms', array( __CLASS__, 'page_dashboard' ) );
		if ( dlms_is_admin() ) {
			add_submenu_page( 'dlms', 'Students & payments', 'Students & payments', 'manage_options', 'dlms-students', array( __CLASS__, 'page_students' ) );
		}
		add_submenu_page( 'dlms', 'Course setup', 'Course setup', $cap, 'dlms-course', array( __CLASS__, 'page_course' ) );
		add_submenu_page( 'dlms', 'Live classes', 'Live classes', $cap, 'dlms-live', array( __CLASS__, 'page_live' ) );
		add_submenu_page( 'dlms', 'WhatsApp', 'WhatsApp', $cap, 'dlms-whatsapp', array( 'DLMS_WhatsApp', 'page' ) );
		add_submenu_page( 'dlms', 'Assignments', 'Assignments', $cap, 'dlms-assignments', array( __CLASS__, 'page_assignments' ) );
		add_submenu_page( 'dlms', 'Gradebook', 'Gradebook', $cap, 'dlms-gradebook', array( __CLASS__, 'page_gradebook' ) );
		add_submenu_page( 'dlms', 'Certificates', 'Certificates', $cap, 'dlms-certificates', array( __CLASS__, 'page_certificates' ) );
		if ( dlms_is_admin() ) {
			add_submenu_page( 'dlms', 'Settings', 'Settings', 'manage_options', 'dlms-settings', array( __CLASS__, 'page_settings' ) );
		}
	}

	/**
	 * Assets.
	 *
	 * @param string $hook Hook.
	 */
	public static function assets( $hook ) {
		if ( false === strpos( $hook, 'dlms' ) ) {
			return;
		}
		wp_enqueue_style( 'dlms-admin', DLMS_URL . 'assets/admin.css', array(), DLMS_VERSION );
		wp_enqueue_script( 'dlms-admin', DLMS_URL . 'assets/admin.js', array(), DLMS_VERSION, true );
		if ( false !== strpos( $hook, 'dlms-settings' ) ) {
			wp_enqueue_media();
		}
	}

	/**
	 * Page wrapper start.
	 *
	 * @param string $title Title.
	 * @param string $extra Right-side HTML.
	 */
	public static function head( $title, $extra = '' ) {
		echo '<div class="wrap dlms-admin"><div class="dlms-admin-head"><h1>' . esc_html( $title ) . '</h1><div>' . $extra . '</div></div>'; // phpcs:ignore
		if ( isset( $_GET['dlms_msg'] ) ) { // phpcs:ignore WordPress.Security.NonceVerification
			$cls = isset( $_GET['dlms_err'] ) ? 'notice-error' : 'notice-success'; // phpcs:ignore WordPress.Security.NonceVerification
			echo '<div class="notice ' . esc_attr( $cls ) . ' is-dismissible"><p>' . esc_html( sanitize_text_field( wp_unslash( rawurldecode( $_GET['dlms_msg'] ) ) ) ) . '</p></div>'; // phpcs:ignore
		}
	}

	/**
	 * Course <select>.
	 *
	 * @param int    $selected Selected.
	 * @param string $name     Name.
	 * @param bool   $any      Include "all".
	 * @param bool   $submit   Auto submit.
	 */
	public static function course_select( $selected, $name = 'course', $any = false, $submit = false ) {
		$h = '<select name="' . esc_attr( $name ) . '"' . ( $submit ? ' onchange="this.form.submit()"' : '' ) . ' required>';
		$h .= $any ? '<option value="0">All courses</option>' : '<option value="">Choose a course…</option>';
		foreach ( dlms_manageable_courses() as $c ) {
			$h .= '<option value="' . (int) $c->ID . '"' . selected( (int) $selected, (int) $c->ID, false ) . '>' . esc_html( $c->post_title ) . ( 'publish' !== $c->post_status ? ' (' . esc_html( $c->post_status ) . ')' : '' ) . '</option>';
		}
		return $h . '</select>';
	}

	/**
	 * Current course from query, defaulting to the first manageable one.
	 */
	public static function current_course() {
		$id = isset( $_GET['course'] ) ? absint( $_GET['course'] ) : 0; // phpcs:ignore WordPress.Security.NonceVerification
		if ( $id && dlms_can_manage_course( $id ) ) {
			return $id;
		}
		$all = dlms_manageable_courses();
		return $all ? (int) $all[0]->ID : 0;
	}

	/**
	 * Student cell with WhatsApp.
	 *
	 * @param int    $uid  User.
	 * @param string $text WhatsApp text.
	 */
	public static function student_cell( $uid, $text = '' ) {
		$u     = get_userdata( $uid );
		$phone = dlms_user_phone( $uid );
		$h     = '<strong>' . esc_html( dlms_user_name( $uid ) ) . '</strong><br><span class="dlms-muted">' . esc_html( $u ? $u->user_email : '' ) . '</span>';
		if ( $phone ) {
			$h .= '<br><a href="' . esc_url( dlms_wa_link( $phone, $text ) ) . '" target="_blank" rel="noopener" class="dlms-wa">WhatsApp ' . esc_html( $phone ) . '</a>';
		}
		return $h;
	}

	/* =========================================================
	 * Dashboard
	 * ======================================================= */

	/**
	 * Dashboard.
	 */
	public static function page_dashboard() {
		$o = DLMS_Reports::overview();
		self::head( 'Darts LMS', dlms_is_admin() ? '<a class="button button-primary" href="' . esc_url( admin_url( 'admin.php?page=dlms-students#enrol' ) ) . '">+ Enrol a student</a>' : '' );
		echo '<div class="dlms-cards">';
		if ( dlms_is_admin() ) {
			echo '<div class="dlms-stat"><span>Collected this month</span><strong>' . esc_html( dlms_money( $o['revenue_month'] ) ) . '</strong></div>';
			echo '<div class="dlms-stat"><span>Collected in total</span><strong>' . esc_html( dlms_money( $o['revenue_all'] ) ) . '</strong></div>';
			echo '<div class="dlms-stat"><span>Fees still due</span><strong>' . esc_html( dlms_money( $o['due_total'] ) ) . '</strong></div>';
		}
		echo '<div class="dlms-stat"><span>Students enrolled</span><strong>' . (int) $o['students'] . '</strong></div>';
		echo '<div class="dlms-stat"><span>Assignments to mark</span><strong><a href="' . esc_url( admin_url( 'admin.php?page=dlms-assignments&status=submitted' ) ) . '">' . (int) $o['to_grade'] . '</a></strong></div>';
		echo '</div>';

		echo '<div class="dlms-grid2">';
		echo '<div class="dlms-panel"><h2>Live classes today and tomorrow</h2>';
		if ( $o['classes'] ) {
			echo '<table class="widefat striped"><tbody>';
			foreach ( $o['classes'] as $c ) {
				$l = $c['lesson'];
				echo '<tr><td><strong>' . esc_html( $l->post_title ) . '</strong><br><span class="dlms-muted">' . esc_html( get_the_title( $c['course'] ) ) . '</span></td><td>' . esc_html( DLMS_Hub::day_label( $c['start'] ) ) . '</td><td>';
				echo dlms_meta( $l->ID, 'meet_link' ) ? '<a class="button" target="_blank" rel="noopener" href="' . esc_url( dlms_meta( $l->ID, 'meet_link' ) ) . '">Open Meet</a>' : '<span class="dlms-err">No Meet link</span>';
				echo ' <a class="button" href="' . esc_url( DLMS_WhatsApp::compose_url( array( 'course' => $c['course'], 'link' => get_permalink( $l->ID ), 'tpl' => 'class' ) ) ) . '">Send on WhatsApp</a>';
				echo ' <a class="button" href="' . esc_url( admin_url( 'admin.php?page=dlms-live&lesson=' . $l->ID ) ) . '">Attendance</a></td></tr>';
			}
			echo '</tbody></table>';
		} else {
			echo '<p class="dlms-muted">No live classes in the next two days. Add class times in <a href="' . esc_url( admin_url( 'admin.php?page=dlms-course' ) ) . '">Course setup</a>.</p>';
		}
		echo '</div>';

		if ( dlms_is_admin() ) {
			echo '<div class="dlms-panel"><h2>Overdue and due this week</h2>';
			$list = array_merge( $o['overdue'], $o['due_soon'] );
			if ( $list ) {
				echo '<table class="widefat striped"><tbody>';
				foreach ( $list as $f ) {
					$late = DLMS_DB::is_overdue( $f );
					$text = DLMS_Notify::wa_text(
						'due',
						array(
							'name'   => dlms_user_name( $f->user_id ),
							'amount' => dlms_money( $f->balance ),
							'course' => get_the_title( $f->course_id ),
							'date'   => mysql2date( 'j M', $f->due_date ),
						)
					);
					echo '<tr><td>' . self::student_cell( $f->user_id, $text ) . '</td><td>' . esc_html( get_the_title( $f->course_id ) ) . '</td><td><strong class="' . ( $late ? 'dlms-err' : '' ) . '">' . esc_html( dlms_money( $f->balance ) ) . '</strong><br><span class="dlms-muted">' . ( $late ? 'Overdue since ' : 'Due ' ) . esc_html( mysql2date( 'j M', $f->due_date ) ) . '</span></td><td><a class="button" href="' . esc_url( admin_url( 'admin.php?page=dlms-students&fee=' . $f->id ) ) . '">Record payment</a></td></tr>'; // phpcs:ignore
				}
				echo '</tbody></table>';
			} else {
				echo '<p class="dlms-muted">Nothing overdue. 👍</p>';
			}
			echo '</div>';
		}
		echo '</div>';

		if ( dlms_is_admin() && $o['recent'] ) {
			$m = DLMS_Payments::methods();
			echo '<div class="dlms-panel"><h2>Latest payments</h2><table class="widefat striped"><thead><tr><th>Receipt</th><th>Student</th><th>Course</th><th>Amount</th><th>Method</th><th>Date</th></tr></thead><tbody>';
			foreach ( $o['recent'] as $p ) {
				echo '<tr><td>' . ( $p->receipt_no ? '<a href="' . esc_url( DLMS_Payments::receipt_url( $p->id ) ) . '" target="_blank">' . esc_html( $p->receipt_no ) . '</a>' : '–' ) . '</td><td>' . esc_html( dlms_user_name( $p->user_id ) ) . '</td><td>' . esc_html( get_the_title( $p->course_id ) ) . '</td><td>' . esc_html( dlms_money( $p->amount ) ) . '</td><td>' . esc_html( $m[ $p->method ] ?? $p->method ) . '</td><td>' . esc_html( mysql2date( 'j M Y', $p->paid_at ) ) . '</td></tr>';
			}
			echo '</tbody></table></div>';
		}
		self::setup_checklist();
		echo '</div>';
	}

	/**
	 * Getting-started checklist on the dashboard.
	 */
	public static function setup_checklist() {
		if ( ! dlms_is_admin() ) {
			return;
		}
		$items = array(
			array( (bool) dlms_opt( 'upi_id' ), 'Add your UPI ID and WhatsApp number', admin_url( 'admin.php?page=dlms-settings' ) ),
			array( (bool) dlms_opt( 'logo_url' ), 'Upload your logo (used on receipts, certificates and the app icon)', admin_url( 'admin.php?page=dlms-settings' ) ),
			array( (bool) dlms_manageable_courses(), 'Create your first course in Tutor LMS', admin_url( 'admin.php?page=tutor' ) ),
			array( class_exists( 'WooCommerce' ) && 'wc' === ( function_exists( 'tutor_utils' ) ? tutor_utils()->get_option( 'monetize_by' ) : '' ), 'Online payments: set Tutor LMS → Settings → Monetization to WooCommerce, then install "Razorpay for WooCommerce"', admin_url( 'admin.php?page=tutor_settings&tab_page=monetization' ) ),
			array( (bool) dlms_opt( 'google_refresh' ), 'Optional: connect Google Calendar to create Meet links automatically', admin_url( 'admin.php?page=dlms-settings#google' ) ),
		);
		if ( ! in_array( false, array_column( $items, 0 ), true ) ) {
			return;
		}
		echo '<div class="dlms-panel"><h2>Getting started</h2><ul class="dlms-checklist">';
		foreach ( $items as $i ) {
			echo '<li class="' . ( $i[0] ? 'done' : '' ) . '">' . ( $i[0] ? '✅' : '⬜' ) . ' <a href="' . esc_url( $i[2] ) . '">' . esc_html( $i[1] ) . '</a></li>';
		}
		echo '</ul></div>';
	}

	/* =========================================================
	 * Students & payments
	 * ======================================================= */

	/**
	 * Students & payments.
	 */
	public static function page_students() {
		if ( ! dlms_is_admin() ) {
			wp_die( 'Not allowed' );
		}
		$fee_id = isset( $_GET['fee'] ) ? absint( $_GET['fee'] ) : 0; // phpcs:ignore WordPress.Security.NonceVerification
		if ( $fee_id && DLMS_DB::fee_by_id( $fee_id ) && ! isset( $_GET['list'] ) ) { // phpcs:ignore WordPress.Security.NonceVerification
			self::student_detail( DLMS_DB::fee_by_id( $fee_id ) );
			return;
		}
		$course = isset( $_GET['course'] ) ? absint( $_GET['course'] ) : 0; // phpcs:ignore WordPress.Security.NonceVerification
		$filter = isset( $_GET['show'] ) ? sanitize_key( $_GET['show'] ) : ''; // phpcs:ignore WordPress.Security.NonceVerification
		$search = isset( $_GET['s'] ) ? sanitize_text_field( wp_unslash( $_GET['s'] ) ) : ''; // phpcs:ignore WordPress.Security.NonceVerification
		self::head( 'Students & payments', '<a class="button" href="' . esc_url( DLMS_Reports::export_url( 'payments', $course ) ) . '">Export payments (CSV)</a>' );

		echo '<form method="get" class="dlms-filters"><input type="hidden" name="page" value="dlms-students">' . self::course_select( $course, 'course', true ) // phpcs:ignore
			. ' <select name="show"><option value="">Everyone</option><option value="due"' . selected( $filter, 'due', false ) . '>Balance due</option><option value="overdue"' . selected( $filter, 'overdue', false ) . '>Overdue</option><option value="paid"' . selected( $filter, 'paid', false ) . '>Fully paid</option></select>'
			. ' <input type="search" name="s" value="' . esc_attr( $search ) . '" placeholder="Name, email or phone"> <button class="button">Filter</button></form>';

		$rows = DLMS_DB::fees( array( 'course_id' => $course ) );
		$rows = array_filter(
			$rows,
			function ( $f ) use ( $filter, $search ) {
				if ( 'due' === $filter && $f->balance <= 0 ) {
					return false;
				}
				if ( 'paid' === $filter && $f->balance > 0 ) {
					return false;
				}
				if ( 'overdue' === $filter && ! DLMS_DB::is_overdue( $f ) ) {
					return false;
				}
				if ( $search ) {
					$u   = get_userdata( $f->user_id );
					$hay = strtolower( dlms_user_name( $f->user_id ) . ' ' . ( $u ? $u->user_email : '' ) . ' ' . dlms_user_phone( $f->user_id ) );
					return false !== strpos( $hay, strtolower( $search ) );
				}
				return true;
			}
		);
		echo '<table class="widefat striped dlms-table-admin"><thead><tr><th>Student</th><th>Course</th><th>Fee</th><th>Paid</th><th>Balance</th><th>Plan</th><th></th></tr></thead><tbody>';
		if ( ! $rows ) {
			echo '<tr><td colspan="7">No students match. Enrol one below.</td></tr>';
		}
		foreach ( $rows as $f ) {
			$late = DLMS_DB::is_overdue( $f );
			$text = $f->balance > 0 ? DLMS_Notify::wa_text(
				'due',
				array(
					'name'   => dlms_user_name( $f->user_id ),
					'amount' => dlms_money( $f->balance ),
					'course' => get_the_title( $f->course_id ),
					'date'   => $f->due_date ? mysql2date( 'j M', $f->due_date ) : 'soon',
				)
			) : '';
			echo '<tr><td>' . self::student_cell( $f->user_id, $text ) . '</td><td>' . esc_html( get_the_title( $f->course_id ) ) . ( dlms_is_enrolled( $f->course_id, $f->user_id ) ? '' : ' <span class="dlms-err">(not enrolled)</span>' ) . '</td><td>' . esc_html( dlms_money( $f->total_fee ) ) . '</td><td>' . esc_html( dlms_money( $f->paid ) ) . '</td>'; // phpcs:ignore
			echo '<td>' . ( $f->balance > 0 ? '<strong class="' . ( $late ? 'dlms-err' : '' ) . '">' . esc_html( dlms_money( $f->balance ) ) . '</strong>' . ( $f->due_date ? '<br><span class="dlms-muted">due ' . esc_html( mysql2date( 'j M Y', $f->due_date ) ) . ( $late ? ' · locked' : '' ) . '</span>' : '' ) : '<span class="dlms-ok">Paid</span>' ) . '</td>';
			echo '<td class="dlms-muted">' . esc_html( $f->plan_note ) . '</td><td><a class="button" href="' . esc_url( admin_url( 'admin.php?page=dlms-students&fee=' . $f->id ) ) . '">Open</a></td></tr>';
		}
		echo '</tbody></table>';

		// Manual enrolment.
		$methods = DLMS_Payments::methods();
		echo '<div class="dlms-panel" id="enrol"><h2>Enrol a student</h2><p class="dlms-muted">Use this for UPI, cash or bank payments. A new student gets an email to set a password. For online Razorpay payments, students enrol themselves through checkout.</p>';
		echo '<form method="post" action="' . esc_url( admin_url( 'admin-post.php' ) ) . '" class="dlms-form-grid">';
		wp_nonce_field( 'dlms_manual_enrol' );
		echo '<input type="hidden" name="action" value="dlms_manual_enrol">';
		echo '<label>Full name<input type="text" name="name" required></label>';
		echo '<label>Email<input type="email" name="email" required></label>';
		echo '<label>WhatsApp number<input type="text" name="phone" placeholder="10-digit mobile"></label>';
		echo '<label>Course' . self::course_select( 0, 'course_id' ) . '</label>'; // phpcs:ignore
		echo '<label>Total fee (' . esc_html( dlms_opt( 'currency_symbol' ) ) . ')<input type="number" step="0.01" min="0" name="total_fee" data-dlms-fee required></label>';
		echo '<label>Paid now<input type="number" step="0.01" min="0" name="paid_now" value="0"></label>';
		echo '<label>Method<select name="method">';
		foreach ( $methods as $k => $v ) {
			if ( 'credit' !== $k ) {
				echo '<option value="' . esc_attr( $k ) . '">' . esc_html( $v ) . '</option>';
			}
		}
		echo '</select></label>';
		echo '<label>UPI / transaction ref<input type="text" name="reference"></label>';
		echo '<label>Paid on<input type="date" name="paid_on" value="' . esc_attr( dlms_today() ) . '"></label>';
		echo '<label>Balance due by<input type="date" name="due_date"></label>';
		echo '<label class="wide">Plan note<input type="text" name="plan_note" placeholder="e.g. ₹10,000 now, ₹15,000 by 1 Dec"></label>';
		echo '<label class="check"><input type="checkbox" name="apply_credit" value="1" checked> Apply course credit if the student has one</label>';
		echo '<label class="check"><input type="checkbox" name="send_welcome" value="1" checked> Email the student (login link and receipt)</label>';
		echo '<p class="wide"><button class="button button-primary button-hero">Enrol student</button></p>';
		echo '</form>';
		echo '<script>window.DLMS_FEES=' . wp_json_encode( self::course_fee_map() ) . ';</script></div>';
		echo '</div>';
	}

	/**
	 * Course id => default fee (prefills the enrol form).
	 */
	public static function course_fee_map() {
		$out = array();
		foreach ( dlms_manageable_courses() as $c ) {
			$out[ $c->ID ] = DLMS_Courses::fee( $c->ID );
		}
		return $out;
	}

	/**
	 * One student's fee and payments.
	 *
	 * @param object $f Fee row.
	 */
	public static function student_detail( $f ) {
		$bal     = DLMS_DB::balance( $f );
		$methods = DLMS_Payments::methods();
		self::head( dlms_user_name( $f->user_id ) . ' · ' . get_the_title( $f->course_id ), '<a class="button" href="' . esc_url( admin_url( 'admin.php?page=dlms-students' ) ) . '">← All students</a>' );
		$text = DLMS_Notify::wa_text(
			$bal > 0 ? 'due' : 'welcome',
			array(
				'name'   => dlms_user_name( $f->user_id ),
				'amount' => dlms_money( $bal ),
				'course' => get_the_title( $f->course_id ),
				'date'   => $f->due_date ? mysql2date( 'j M', $f->due_date ) : 'soon',
				'email'  => get_userdata( $f->user_id ) ? get_userdata( $f->user_id )->user_email : '',
			)
		);
		echo '<div class="dlms-cards"><div class="dlms-stat"><span>Total fee</span><strong>' . esc_html( dlms_money( $f->total_fee ) ) . '</strong></div><div class="dlms-stat"><span>Paid</span><strong>' . esc_html( dlms_money( DLMS_DB::paid( $f->id ) ) ) . '</strong></div><div class="dlms-stat"><span>Balance</span><strong class="' . ( DLMS_DB::is_overdue( $f ) ? 'dlms-err' : '' ) . '">' . esc_html( dlms_money( $bal ) ) . '</strong></div>';
		echo '<div class="dlms-stat"><span>Contact</span>' . self::student_cell( $f->user_id, $text ) . '</div></div>'; // phpcs:ignore

		echo '<div class="dlms-grid2"><div class="dlms-panel"><h2>Payments</h2><table class="widefat striped"><thead><tr><th>Receipt</th><th>Date</th><th>Amount</th><th>Method</th><th>Ref / note</th><th></th></tr></thead><tbody>';
		$pays = DLMS_DB::payments( $f->id );
		if ( ! $pays ) {
			echo '<tr><td colspan="6">No payments yet.</td></tr>';
		}
		foreach ( $pays as $p ) {
			$del = wp_nonce_url( admin_url( 'admin-post.php?action=dlms_delete_payment&payment=' . $p->id ), 'dlms_delete_payment' );
			echo '<tr><td>' . ( $p->receipt_no ? '<a href="' . esc_url( DLMS_Payments::receipt_url( $p->id ) ) . '" target="_blank">' . esc_html( $p->receipt_no ) . '</a>' : '–' ) . '</td><td>' . esc_html( mysql2date( 'j M Y', $p->paid_at ) ) . '</td><td>' . esc_html( dlms_money( $p->amount ) ) . '</td><td>' . esc_html( $methods[ $p->method ] ?? $p->method ) . '</td><td class="dlms-muted">' . esc_html( trim( $p->reference . ' ' . $p->note ) ) . '</td><td><a class="dlms-del" href="' . esc_url( $del ) . '" onclick="return confirm(\'Delete this payment?\')">Delete</a></td></tr>';
		}
		echo '</tbody></table>';

		echo '<h3>Record a payment</h3><form method="post" action="' . esc_url( admin_url( 'admin-post.php' ) ) . '" class="dlms-form-grid">';
		wp_nonce_field( 'dlms_add_payment' );
		echo '<input type="hidden" name="action" value="dlms_add_payment"><input type="hidden" name="fee_id" value="' . (int) $f->id . '">';
		echo '<label>Amount<input type="number" step="0.01" min="0.01" name="amount" value="' . esc_attr( $bal ) . '" required></label>';
		echo '<label>Method<select name="method">';
		foreach ( $methods as $k => $v ) {
			echo '<option value="' . esc_attr( $k ) . '">' . esc_html( $v ) . '</option>';
		}
		echo '</select></label><label>UPI / transaction ref<input type="text" name="reference"></label><label>Paid on<input type="date" name="paid_on" value="' . esc_attr( dlms_today() ) . '"></label>';
		echo '<label>Next due date (if a balance is left)<input type="date" name="next_due"></label><label>Note<input type="text" name="note"></label>';
		echo '<p class="wide"><button class="button button-primary">Save payment and email receipt</button></p></form></div>';

		echo '<div class="dlms-panel"><h2>Fee plan</h2><form method="post" action="' . esc_url( admin_url( 'admin-post.php' ) ) . '" class="dlms-form-grid one">';
		wp_nonce_field( 'dlms_save_fee' );
		echo '<input type="hidden" name="action" value="dlms_save_fee"><input type="hidden" name="fee_id" value="' . (int) $f->id . '">';
		echo '<label>Total fee<input type="number" step="0.01" min="0" name="total_fee" value="' . esc_attr( $f->total_fee ) . '"></label>';
		echo '<label>Balance due by<input type="date" name="due_date" value="' . esc_attr( (string) $f->due_date ) . '"></label>';
		echo '<label>Plan note<input type="text" name="plan_note" value="' . esc_attr( $f->plan_note ) . '"></label>';
		echo '<label>WhatsApp number<input type="text" name="phone" value="' . esc_attr( dlms_user_phone( $f->user_id ) ) . '"></label>';
		echo '<p><button class="button">Save plan</button></p></form>';
		echo '<p class="dlms-muted">When the due date passes with a balance left' . ( dlms_opt( 'grace_days' ) ? ' (plus ' . (int) dlms_opt( 'grace_days' ) . ' grace days)' : '' ) . ', lessons lock until you record the payment. Clear the date to never lock.</p>';
		echo '<p><a href="' . esc_url( admin_url( 'user-edit.php?user_id=' . $f->user_id ) ) . '">Edit user account</a></p></div></div>';
		echo '</div>';
	}

	/* =========================================================
	 * Course setup
	 * ======================================================= */

	/**
	 * Course setup.
	 */
	public static function page_course() {
		$cid = self::current_course();
		self::head( 'Course setup' );
		echo '<form method="get" class="dlms-filters"><input type="hidden" name="page" value="dlms-course">' . self::course_select( $cid, 'course', false, true ) . ( $cid ? ' <a class="button" href="' . esc_url( get_edit_post_link( $cid ) ) . '">Edit course content in Tutor</a> <a class="button" href="' . esc_url( get_permalink( $cid ) ) . '" target="_blank">View course</a>' : '' ) . '</form>'; // phpcs:ignore
		if ( ! $cid ) {
			echo '<p>Create a course in Tutor LMS first (Tutor LMS → Courses → Add new), with topics and lessons. Then come back here to add live class times, recordings, drip, assignments and fees.</p></div>';
			return;
		}
		$m       = fn( $k ) => dlms_meta( $cid, $k );
		$others  = array_filter( dlms_manageable_courses(), fn( $c ) => (int) $c->ID !== $cid );
		$multi   = function ( $name, $sel ) use ( $others ) {
			$h = '<select name="course[' . $name . '][]" multiple size="' . max( 2, min( 5, count( $others ) ) ) . '">';
			foreach ( $others as $c ) {
				$h .= '<option value="' . (int) $c->ID . '"' . ( in_array( (int) $c->ID, $sel, true ) ? ' selected' : '' ) . '>' . esc_html( $c->post_title ) . '</option>';
			}
			return $h . '</select>';
		};

		echo '<form method="post" action="' . esc_url( admin_url( 'admin-post.php' ) ) . '">';
		wp_nonce_field( 'dlms_save_course' );
		echo '<input type="hidden" name="action" value="dlms_save_course"><input type="hidden" name="course_id" value="' . (int) $cid . '">';

		echo '<div class="dlms-panel"><h2>Course rules</h2><div class="dlms-form-grid">';
		echo '<label>Course fee (' . esc_html( dlms_opt( 'currency_symbol' ) ) . ')<input type="number" step="0.01" min="0" name="course[fee]" value="' . esc_attr( $m( 'fee' ) ) . '" placeholder="' . esc_attr( DLMS_Courses::fee( $cid ) ) . '"><small>Leave empty to use the Tutor/WooCommerce price.</small></label>';
		echo '<label>Lessons unlock in order<select name="course[sequential]"><option value="">No, any order</option><option value="1"' . selected( $m( 'sequential' ), '1', false ) . '>Yes, finish the previous lesson first</option></select><small>Live-class lessons never block the next one.</small></label>';
		echo '<label>Must finish these courses first' . $multi( 'prereq_courses', DLMS_Courses::ids( $cid, 'prereq_courses' ) ) . '</label>'; // phpcs:ignore
		echo '<label>Bundle: enrolling here also enrols in' . $multi( 'bundle_courses', DLMS_Courses::ids( $cid, 'bundle_courses' ) ) . '</label>'; // phpcs:ignore
		echo '<label>Fee counts as credit toward<select name="course[credit_to]"><option value="">No credit</option>';
		foreach ( $others as $c ) {
			echo '<option value="' . (int) $c->ID . '"' . selected( (int) $m( 'credit_to' ), (int) $c->ID, false ) . '>' . esc_html( $c->post_title ) . '</option>';
		}
		echo '</select><small>E.g. the 15-day course fee is credited to the AI Business Builder. Students get a personal coupon.</small></label>';
		echo '<label>How students enrol<select name="course[enrol_wa]"><option value="">Normal Tutor enrol / checkout</option><option value="1"' . selected( $m( 'enrol_wa' ), '1', false ) . '>On WhatsApp: you send the UPI QR and enrol them</option></select><small>WhatsApp mode hides the Enrol button and shows "Enrol on WhatsApp".</small></label>';
		echo '<label>Certificate<select name="course[cert_off]"><option value="">Issue automatically on completion</option><option value="1"' . selected( $m( 'cert_off' ), '1', false ) . '>No certificate</option></select></label>';
		echo '<label>Minimum attendance for certificate (%)<input type="number" min="0" max="100" name="course[cert_min_attend]" value="' . esc_attr( $m( 'cert_min_attend' ) ) . '" placeholder="0"></label>';
		echo '</div></div>';

		$lessons = dlms_course_lessons( $cid );
		echo '<div class="dlms-panel"><h2>Lessons</h2>';
		if ( ! $lessons ) {
			echo '<p>This course has no published lessons yet. Add topics and lessons in the Tutor course builder.</p>';
		}
		$google = (bool) dlms_opt( 'google_refresh' );
		$topic  = null;
		foreach ( $lessons as $i => $l ) {
			if ( $topic !== $l->dlms_topic ) {
				$topic = $l->dlms_topic;
				echo '<h3 class="dlms-topic">' . esc_html( $topic ) . '</h3>';
			}
			$lm   = fn( $k ) => dlms_meta( $l->ID, $k );
			$n    = 'lessons[' . (int) $l->ID . ']';
			$live = $lm( 'live_start' );
			$sum  = array();
			if ( $live ) {
				$sum[] = '📅 ' . dlms_date( dlms_local_to_ts( $live ), 'j M, g:i A' );
			}
			if ( $lm( 'recording_url' ) ) {
				$sum[] = '🎬 recording';
			}
			if ( $lm( 'unlock_mode' ) ) {
				$sum[] = '⏳ drip';
			}
			if ( $lm( 'has_assignment' ) ) {
				$sum[] = '📝 assignment';
			}
			echo '<details class="dlms-lesson"' . ( 0 === $i && ! $sum ? ' open' : '' ) . '><summary><strong>' . esc_html( $l->post_title ) . '</strong> <span class="dlms-muted">' . esc_html( implode( ' · ', $sum ) ) . '</span></summary><div class="dlms-form-grid">';
			echo '<fieldset><legend>Live class (Google Meet)</legend>';
			echo '<label>Date and time<input type="datetime-local" name="' . $n . '[live_start]" value="' . esc_attr( $live ? str_replace( ' ', 'T', $live ) : '' ) . '"></label>'; // phpcs:ignore
			echo '<label>Duration (minutes)<input type="number" min="15" step="5" name="' . $n . '[live_duration]" value="' . esc_attr( $lm( 'live_duration' ) ? $lm( 'live_duration' ) : 60 ) . '"></label>'; // phpcs:ignore
			echo '<label>Meet link<input type="url" name="' . $n . '[meet_link]" value="' . esc_attr( $lm( 'meet_link' ) ) . '" placeholder="https://meet.google.com/…"></label>'; // phpcs:ignore
			if ( $live && $google ) {
				echo '<p><a class="button" href="' . esc_url( wp_nonce_url( admin_url( 'admin-post.php?action=dlms_create_meet&lesson=' . $l->ID ), 'dlms_create_meet' ) ) . '">' . ( $lm( 'meet_link' ) ? 'Update Calendar event' : 'Create Meet link' ) . '</a></p>';
			} elseif ( ! $google ) {
				echo '<p class="dlms-muted"><small>Paste a Meet link, or <a href="' . esc_url( admin_url( 'admin.php?page=dlms-settings#google' ) ) . '">connect Google</a> to create them in one click.</small></p>';
			}
			echo '<label>Recording (YouTube unlisted / Google Drive link)<input type="url" name="' . $n . '[recording_url]" value="' . esc_attr( $lm( 'recording_url' ) ) . '"></label></fieldset>'; // phpcs:ignore

			echo '<fieldset><legend>Drip (when it opens)</legend><label>Opens<select name="' . $n . '[unlock_mode]" data-dlms-toggle>'; // phpcs:ignore
			foreach ( array(
				''     => 'Straight away',
				'date' => 'On a date',
				'days' => 'X days after enrolment',
				'live' => '1 hour before its live class',
			) as $k => $v ) {
				echo '<option value="' . esc_attr( $k ) . '"' . selected( $lm( 'unlock_mode' ), $k, false ) . '>' . esc_html( $v ) . '</option>';
			}
			echo '</select></label><label data-show="date">Date<input type="date" name="' . $n . '[unlock_date]" value="' . esc_attr( $lm( 'unlock_date' ) ) . '"></label>'; // phpcs:ignore
			echo '<label data-show="days">Days after enrolment<input type="number" min="0" name="' . $n . '[unlock_days]" value="' . esc_attr( $lm( 'unlock_days' ) ) . '"></label></fieldset>'; // phpcs:ignore

			echo '<fieldset class="wide"><legend>Assignment</legend><label class="check"><input type="checkbox" name="' . $n . '[has_assignment]" value="1"' . checked( $lm( 'has_assignment' ), '1', false ) . '> This lesson has an assignment</label>'; // phpcs:ignore
			echo '<label>Instructions<textarea rows="3" name="' . $n . '[assign_text]">' . esc_textarea( $lm( 'assign_text' ) ) . '</textarea></label>'; // phpcs:ignore
			echo '<div class="dlms-row"><label>Max marks<input type="number" min="0" step="0.5" name="' . $n . '[assign_max]" value="' . esc_attr( $lm( 'assign_max' ) ? $lm( 'assign_max' ) : 10 ) . '"></label>'; // phpcs:ignore
			echo '<label>Due (days after it opens)<input type="number" min="0" name="' . $n . '[assign_due_days]" value="' . esc_attr( $lm( 'assign_due_days' ) ) . '"></label></div></fieldset>'; // phpcs:ignore
			echo '</div></details>';
		}
		echo '</div>';
		echo '<p class="dlms-sticky"><button class="button button-primary button-hero">Save course setup</button></p></form></div>';
	}

	/**
	 * Save course setup.
	 */
	public static function save_course() {
		check_admin_referer( 'dlms_save_course' );
		$cid = absint( $_POST['course_id'] ?? 0 );
		if ( ! dlms_can_manage_course( $cid ) ) {
			wp_die( 'Not allowed', 403 );
		}
		$course = wp_unslash( (array) ( $_POST['course'] ?? array() ) ); // phpcs:ignore WordPress.Security.ValidatedSanitizedInput -- sanitised per field.
		DLMS_Courses::save_course( $cid, $course );
		$valid = wp_list_pluck( dlms_course_lessons( $cid ), 'ID' );
		foreach ( (array) wp_unslash( $_POST['lessons'] ?? array() ) as $lid => $data ) { // phpcs:ignore WordPress.Security.ValidatedSanitizedInput
			if ( in_array( (int) $lid, array_map( 'intval', $valid ), true ) ) {
				DLMS_Courses::save_lesson( (int) $lid, (array) $data );
			}
		}
		DLMS_Payments::back( 'dlms-course', 'Course setup saved.', array( 'course' => $cid ) );
	}

	/* =========================================================
	 * Live classes + attendance
	 * ======================================================= */

	/**
	 * Live classes.
	 */
	public static function page_live() {
		$lesson_id = isset( $_GET['lesson'] ) ? absint( $_GET['lesson'] ) : 0; // phpcs:ignore WordPress.Security.NonceVerification
		if ( $lesson_id && dlms_can_manage_course( dlms_lesson_course( $lesson_id ) ) ) {
			self::attendance_screen( $lesson_id );
			return;
		}
		$cid = self::current_course();
		self::head( 'Live classes', $cid ? '<a class="button" href="' . esc_url( DLMS_Reports::export_url( 'attendance', $cid ) ) . '">Export attendance (CSV)</a>' : '' );
		echo '<form method="get" class="dlms-filters"><input type="hidden" name="page" value="dlms-live">' . self::course_select( $cid, 'course', false, true ) . '</form>'; // phpcs:ignore
		$lessons = $cid ? DLMS_Live::course_live_lessons( $cid ) : array();
		echo '<table class="widefat striped"><thead><tr><th>Class</th><th>When</th><th>Meet</th><th>Recording</th><th>Attended</th><th></th></tr></thead><tbody>';
		if ( ! $lessons ) {
			echo '<tr><td colspan="6">No live classes yet. Add date and time to lessons in <a href="' . esc_url( admin_url( 'admin.php?page=dlms-course&course=' . $cid ) ) . '">Course setup</a>.</td></tr>';
		}
		$students = $cid ? count( dlms_course_students( $cid ) ) : 0;
		foreach ( $lessons as $l ) {
			$start = DLMS_Live::start_ts( $l->ID );
			$state = DLMS_Live::state( $l->ID );
			$att   = count( DLMS_DB::attendance_for_lesson( $l->ID ) );
			echo '<tr><td><strong>' . esc_html( $l->post_title ) . '</strong><br><span class="dlms-pill dlms-state-' . esc_attr( $state ) . '">' . esc_html( $state ) . '</span></td><td>' . esc_html( dlms_date( $start ) ) . '</td>';
			echo '<td>' . ( dlms_meta( $l->ID, 'meet_link' ) ? '<a href="' . esc_url( dlms_meta( $l->ID, 'meet_link' ) ) . '" target="_blank" rel="noopener">Open</a>' : '<span class="dlms-err">Missing</span>' ) . '</td>';
			echo '<td>' . ( dlms_meta( $l->ID, 'recording_url' ) ? '✅' : ( 'ended' === $state ? '<span class="dlms-err">Add it</span>' : '–' ) ) . '</td>';
			echo '<td>' . ( $start <= time() ? (int) $att . ' / ' . (int) $students : '–' ) . '</td><td><a class="button" href="' . esc_url( DLMS_WhatsApp::compose_url( array( 'course' => $cid, 'link' => get_permalink( $l->ID ), 'tpl' => dlms_meta( $l->ID, 'recording_url' ) && 'ended' === $state ? 'recording' : 'class' ) ) ) . '">Send on WhatsApp</a> <a class="button" href="' . esc_url( admin_url( 'admin.php?page=dlms-live&lesson=' . $l->ID ) ) . '">Attendance</a></td></tr>';
		}
		echo '</tbody></table></div>';
	}

	/**
	 * Attendance for one class.
	 *
	 * @param int $lesson_id Lesson.
	 */
	public static function attendance_screen( $lesson_id ) {
		$cid   = dlms_lesson_course( $lesson_id );
		$start = DLMS_Live::start_ts( $lesson_id );
		self::head( 'Attendance · ' . get_the_title( $lesson_id ), '<a class="button" href="' . esc_url( admin_url( 'admin.php?page=dlms-live&course=' . $cid ) ) . '">← All classes</a>' );
		echo '<p>' . esc_html( get_the_title( $cid ) ) . ' · ' . esc_html( dlms_date( $start ) ) . '. Students who clicked Join are ticked automatically. Tick anyone else who attended.</p>';
		$att = DLMS_DB::attendance_for_lesson( $lesson_id );
		echo '<form method="post" action="' . esc_url( admin_url( 'admin-post.php' ) ) . '">';
		wp_nonce_field( 'dlms_save_attendance' );
		echo '<input type="hidden" name="action" value="dlms_save_attendance"><input type="hidden" name="lesson_id" value="' . (int) $lesson_id . '">';
		echo '<table class="widefat striped"><thead><tr><th style="width:60px">Present</th><th>Student</th><th>Joined</th><th>Remind</th></tr></thead><tbody>';
		$students = dlms_course_students( $cid );
		if ( ! $students ) {
			echo '<tr><td colspan="4">No students enrolled yet.</td></tr>';
		}
		foreach ( $students as $uid ) {
			$a    = $att[ $uid ] ?? null;
			$text = DLMS_Notify::wa_text(
				'class',
				array(
					'name'   => dlms_user_name( $uid ),
					'lesson' => get_the_title( $lesson_id ),
					'time'   => dlms_date( $start, 'g:i A' ),
					'url'    => get_permalink( $lesson_id ),
				)
			);
			echo '<tr><td><input type="checkbox" name="present[]" value="' . (int) $uid . '"' . checked( (bool) $a, true, false ) . '></td><td>' . esc_html( dlms_user_name( $uid ) ) . '</td><td class="dlms-muted">' . ( $a ? esc_html( mysql2date( 'g:i A', $a->joined_at ) . ' (' . $a->source . ')' ) : '–' ) . '</td><td>' . ( dlms_user_phone( $uid ) ? '<a href="' . esc_url( dlms_wa_link( dlms_user_phone( $uid ), $text ) ) . '" target="_blank" rel="noopener" class="dlms-wa">WhatsApp</a>' : '' ) . '</td></tr>';
		}
		echo '</tbody></table><p><button class="button button-primary">Save attendance</button></p></form></div>';
	}

	/* =========================================================
	 * Assignments
	 * ======================================================= */

	/**
	 * Assignments to mark.
	 */
	public static function page_assignments() {
		$cid    = isset( $_GET['course'] ) ? absint( $_GET['course'] ) : 0; // phpcs:ignore WordPress.Security.NonceVerification
		$status = isset( $_GET['status'] ) ? sanitize_key( $_GET['status'] ) : 'submitted'; // phpcs:ignore WordPress.Security.NonceVerification
		self::head( 'Assignments' );
		echo '<form method="get" class="dlms-filters"><input type="hidden" name="page" value="dlms-assignments">' . self::course_select( $cid, 'course', true ) // phpcs:ignore
			. ' <select name="status"><option value="submitted"' . selected( $status, 'submitted', false ) . '>To mark</option><option value="graded"' . selected( $status, 'graded', false ) . '>Marked</option><option value="returned"' . selected( $status, 'returned', false ) . '>Returned for redo</option><option value="all"' . selected( $status, 'all', false ) . '>All</option></select> <button class="button">Filter</button></form>';
		$args = array( 'status' => 'all' === $status ? '' : $status );
		if ( $cid && dlms_can_manage_course( $cid ) ) {
			$args['course_id'] = $cid;
		} elseif ( ! dlms_is_admin() ) {
			$args['course_ids'] = wp_list_pluck( dlms_manageable_courses(), 'ID' );
			if ( ! $args['course_ids'] ) {
				$args['course_ids'] = array( 0 );
			}
		}
		$subs = DLMS_DB::submissions( $args );
		if ( ! $subs ) {
			echo '<p>Nothing here. 🎉</p></div>';
			return;
		}
		foreach ( $subs as $s ) {
			echo '<div class="dlms-panel dlms-sub"><div class="dlms-sub-head"><div><strong>' . esc_html( dlms_user_name( $s->user_id ) ) . '</strong> · ' . esc_html( get_the_title( $s->lesson_id ) ) . '<br><span class="dlms-muted">' . esc_html( get_the_title( $s->course_id ) ) . ' · submitted ' . esc_html( mysql2date( 'j M Y, g:i A', $s->submitted_at ) ) . '</span></div><span class="dlms-pill dlms-state-' . esc_attr( $s->status ) . '">' . esc_html( $s->status ) . '</span></div>';
			if ( $s->answer ) {
				echo '<div class="dlms-answer">' . wpautop( wp_kses_post( $s->answer ) ) . '</div>'; // phpcs:ignore
			}
			if ( $s->link ) {
				echo '<p>🔗 <a href="' . esc_url( $s->link ) . '" target="_blank" rel="noopener nofollow">' . esc_html( $s->link ) . '</a></p>';
			}
			if ( $s->file_name ) {
				echo '<p>📎 <a href="' . esc_url( DLMS_Assignments::file_url( $s->id ) ) . '">' . esc_html( $s->file_name ) . '</a></p>';
			}
			echo '<form method="post" action="' . esc_url( admin_url( 'admin-post.php' ) ) . '" class="dlms-grade-form">';
			wp_nonce_field( 'dlms_grade' );
			echo '<input type="hidden" name="action" value="dlms_grade"><input type="hidden" name="submission_id" value="' . (int) $s->id . '">';
			echo '<label>Marks<input type="number" step="0.5" min="0" name="marks" value="' . esc_attr( null !== $s->marks ? (float) $s->marks : '' ) . '" required></label>';
			echo '<label>Out of<input type="number" step="0.5" min="0" name="max_marks" value="' . esc_attr( (float) $s->max_marks ) . '"></label>';
			echo '<label class="grow">Feedback<textarea name="feedback" rows="2">' . esc_textarea( (string) $s->feedback ) . '</textarea></label>';
			echo '<label>Result<select name="status"><option value="graded">Mark as done</option><option value="returned"' . selected( $s->status, 'returned', false ) . '>Return for redo</option></select></label>';
			echo '<button class="button button-primary">Save</button></form></div>';
		}
		echo '</div>';
	}

	/* =========================================================
	 * Gradebook
	 * ======================================================= */

	/**
	 * Gradebook.
	 */
	public static function page_gradebook() {
		$cid = self::current_course();
		self::head( 'Gradebook', $cid ? '<a class="button" href="' . esc_url( DLMS_Reports::export_url( 'gradebook', $cid ) ) . '">Export (CSV)</a>' : '' );
		echo '<form method="get" class="dlms-filters"><input type="hidden" name="page" value="dlms-gradebook">' . self::course_select( $cid, 'course', false, true ) . '</form>'; // phpcs:ignore
		if ( ! $cid ) {
			echo '</div>';
			return;
		}
		$rows = DLMS_Reports::gradebook( $cid );
		$pct  = fn( $v ) => null === $v ? '–' : (int) $v . '%';
		echo '<table class="widefat striped dlms-table-admin"><thead><tr><th>Student</th><th>Progress</th><th>Quizzes</th><th>Assignments</th><th>Attendance</th>' . ( dlms_is_admin() ? '<th>Balance</th>' : '' ) . '<th>Certificate</th></tr></thead><tbody>';
		if ( ! $rows ) {
			echo '<tr><td colspan="7">No students enrolled yet.</td></tr>';
		}
		foreach ( $rows as $r ) {
			echo '<tr><td>' . self::student_cell( $r['user_id'] ) . '</td><td><div class="dlms-bar"><span style="width:' . (int) $r['progress'] . '%"></span></div>' . (int) $r['progress'] . '%</td><td>' . esc_html( $pct( $r['quiz'] ) ) . '</td><td>' . esc_html( $pct( $r['assignments'] ) ) . ' <span class="dlms-muted">(' . esc_html( $r['submitted'] ) . ')</span></td><td>' . esc_html( $pct( $r['attendance'] ) ) . '</td>'; // phpcs:ignore
			if ( dlms_is_admin() ) {
				echo '<td>' . ( $r['balance'] > 0 ? '<strong>' . esc_html( dlms_money( $r['balance'] ) ) . '</strong>' : '<span class="dlms-ok">Paid</span>' ) . '</td>';
			}
			echo '<td>' . ( $r['certificate'] ? '<a href="' . esc_url( DLMS_Certificates::download_url( $r['certificate'] ) ) . '" target="_blank">' . esc_html( $r['certificate'] ) . '</a>' : '<form method="post" action="' . esc_url( admin_url( 'admin-post.php' ) ) . '">' . wp_nonce_field( 'dlms_issue_certificate', '_wpnonce', true, false ) . '<input type="hidden" name="action" value="dlms_issue_certificate"><input type="hidden" name="course_id" value="' . (int) $cid . '"><input type="hidden" name="user_id" value="' . (int) $r['user_id'] . '"><button class="button button-small">Issue</button></form>' ) . '</td></tr>';
		}
		echo '</tbody></table></div>';
	}

	/* =========================================================
	 * Certificates
	 * ======================================================= */

	/**
	 * Certificates.
	 */
	public static function page_certificates() {
		self::head( 'Certificates', '<a class="button" href="' . esc_url( DLMS_Certificates::verify_url() ) . '" target="_blank">Public verify page</a>' );
		$list = DLMS_DB::certificates();
		$list = array_filter( $list, fn( $c ) => dlms_can_manage_course( $c->course_id ) );
		echo '<p class="dlms-muted">Certificates are issued automatically when a student completes a course. Issue one by hand from the Gradebook.</p>';
		echo '<table class="widefat striped"><thead><tr><th>ID</th><th>Student</th><th>Course</th><th>Issued</th><th></th></tr></thead><tbody>';
		if ( ! $list ) {
			echo '<tr><td colspan="5">No certificates yet.</td></tr>';
		}
		foreach ( $list as $c ) {
			$rev = wp_nonce_url( admin_url( 'admin-post.php?action=dlms_revoke_certificate&code=' . rawurlencode( $c->code ) ), 'dlms_revoke_certificate' );
			echo '<tr' . ( $c->revoked ? ' class="dlms-revoked"' : '' ) . '><td><a href="' . esc_url( DLMS_Certificates::download_url( $c->code ) ) . '" target="_blank">' . esc_html( $c->code ) . '</a></td><td>' . esc_html( $c->student_name ) . '</td><td>' . esc_html( $c->course_name ) . '</td><td>' . esc_html( mysql2date( 'j M Y', $c->issued_at ) ) . '</td><td><a href="' . esc_url( $rev ) . '">' . ( $c->revoked ? 'Restore' : 'Revoke' ) . '</a></td></tr>';
		}
		echo '</tbody></table></div>';
	}

	/* =========================================================
	 * Settings
	 * ======================================================= */

	/**
	 * Settings.
	 */
	public static function page_settings() {
		if ( ! dlms_is_admin() ) {
			wp_die( 'Not allowed' );
		}
		$o = dlms_opt();
		self::head( 'Darts LMS settings' );
		$text = function ( $k, $label, $type = 'text', $help = '' ) use ( $o ) {
			return '<label>' . esc_html( $label ) . '<input type="' . esc_attr( $type ) . '" name="s[' . esc_attr( $k ) . ']" value="' . esc_attr( $o[ $k ] ) . '"' . ( 'number' === $type ? ' step="any"' : '' ) . '>' . ( $help ? '<small>' . wp_kses_post( $help ) . '</small>' : '' ) . '</label>';
		};
		$check = function ( $k, $label ) use ( $o ) {
			return '<label class="check"><input type="hidden" name="s[' . esc_attr( $k ) . ']" value="0"><input type="checkbox" name="s[' . esc_attr( $k ) . ']" value="1"' . checked( (int) $o[ $k ], 1, false ) . '> ' . esc_html( $label ) . '</label>';
		};
		echo '<form method="post" action="' . esc_url( admin_url( 'admin-post.php' ) ) . '">';
		wp_nonce_field( 'dlms_save_settings' );
		echo '<input type="hidden" name="action" value="dlms_save_settings">';

		echo '<div class="dlms-panel"><h2>Brand</h2><div class="dlms-form-grid">';
		echo $text( 'academy_name', 'Academy name' ) . $text( 'brand_color', 'Brand colour', 'color' ); // phpcs:ignore
		echo '<label>Logo<span class="dlms-row"><input type="url" name="s[logo_url]" id="dlms-logo" value="' . esc_attr( $o['logo_url'] ) . '"><button type="button" class="button" data-dlms-media="#dlms-logo">Choose</button></span><small>Upload to the Media Library (PNG works best).</small></label>';
		echo $text( 'signatory_name', 'Name on certificates' ) . $text( 'signatory_title', 'Title on certificates' ); // phpcs:ignore
		echo '</div></div>';

		echo '<div class="dlms-panel"><h2>Payments</h2><div class="dlms-form-grid">';
		echo $text( 'upi_id', 'UPI ID', 'text', 'Shown to students with a balance, with a tap-to-pay UPI button.' ) . $text( 'whatsapp', 'WhatsApp number', 'text', 'With country code, e.g. 917012045854.' ); // phpcs:ignore
		echo $text( 'receipt_prefix', 'Receipt prefix' ) . $text( 'receipt_next', 'Next receipt number', 'number', 'Next receipt: <strong>' . esc_html( $o['receipt_prefix'] . '-' . wp_date( 'Y' ) . '-' . str_pad( (string) (int) $o['receipt_next'], 3, '0', STR_PAD_LEFT ) ) . '</strong>' ); // phpcs:ignore
		echo $text( 'currency_symbol', 'Currency symbol' ) . $text( 'grace_days', 'Grace days after a due date before lessons lock', 'number' ); // phpcs:ignore
		echo '</div></div>';

		echo '<div class="dlms-panel"><h2>Live classes</h2><div class="dlms-form-grid">';
		echo $text( 'join_before_min', 'Join button opens (minutes before)', 'number' ) . $text( 'reminder_min', 'Email reminder (minutes before)', 'number' ); // phpcs:ignore
		echo '</div><h3 id="google">Google Meet links (optional, free)</h3>';
		if ( $o['google_refresh'] ) {
			echo '<p>✅ Connected' . ( $o['google_email'] ? ' as <strong>' . esc_html( $o['google_email'] ) . '</strong>' : '' ) . '. Use "Create Meet link" on each live lesson in Course setup. <a class="button" href="' . esc_url( wp_nonce_url( admin_url( 'admin-post.php?action=dlms_google_disconnect' ), 'dlms_google_disconnect' ) ) . '">Disconnect</a></p>';
		} else {
			echo '<ol class="dlms-steps"><li>Open <a href="https://console.cloud.google.com/" target="_blank" rel="noopener">Google Cloud Console</a>, create a project, and enable the <strong>Google Calendar API</strong>.</li><li>OAuth consent screen: External, add your Gmail as a test user (or publish the app).</li><li>Credentials → Create OAuth client ID → Web application. Add this redirect URI:<br><code>' . esc_html( DLMS_Live::redirect_uri() ) . '</code></li><li>Paste the client ID and secret below, save, then click Connect.</li></ol>';
		}
		echo '<div class="dlms-form-grid">' . $text( 'google_client_id', 'Google client ID' ) . '<label>Google client secret<input type="password" name="s[google_secret]" value="' . esc_attr( $o['google_secret'] ) . '" autocomplete="off"></label></div>'; // phpcs:ignore
		if ( $o['google_client_id'] && ! $o['google_refresh'] ) {
			echo '<p><a class="button button-primary" href="' . esc_url( wp_nonce_url( admin_url( 'admin-post.php?action=dlms_google_connect' ), 'dlms_google_connect' ) ) . '">Connect Google Calendar</a></p>';
		}
		echo '</div>';

		echo '<div class="dlms-panel"><h2>Emails</h2><div class="dlms-form-grid">';
		echo $text( 'support_email', 'Send admin alerts to', 'email' ) . $text( 'due_reminder_days', 'Fee reminder (days before due)', 'number' ); // phpcs:ignore
		echo '</div><div class="dlms-checks">';
		echo $check( 'notify_welcome', 'Welcome email with password link (manual enrolment)' ) . $check( 'notify_enrolled', 'Enrolment confirmation' ) . $check( 'notify_receipt', 'Payment receipt (PDF attached)' ) . $check( 'notify_class', 'Live class reminder' ) . $check( 'notify_due', 'Fee due reminders' ) . $check( 'notify_graded', 'Assignment marked' ) . $check( 'notify_certificate', 'Certificate issued' ) . $check( 'notify_new_lesson', 'New lesson published' ); // phpcs:ignore
		echo '</div><p class="dlms-muted">Emails go through WordPress. On Hostinger, install the free "WP Mail SMTP" plugin with your domain mailbox so they don\'t land in spam.</p></div>';

		echo '<div class="dlms-panel"><h2 id="whatsapp">WhatsApp sending</h2>';
		echo '<p>Free mode (default): the WhatsApp page prepares each message and you tap Send, for students and groups. Automatic mode uses the official WhatsApp Cloud API. It needs a Meta business number and an approved template whose body has {{1}} for the name and {{2}} for the link. Meta charges per message, and groups always stay one-tap.</p>';
		echo '<div class="dlms-form-grid"><label>Mode<select name="s[wa_mode]"><option value="tap"' . selected( $o['wa_mode'], 'tap', false ) . '>Free: one tap per message</option><option value="api"' . selected( $o['wa_mode'], 'api', false ) . '>Automatic: WhatsApp Cloud API</option></select></label>';
		echo $text( 'wa_phone_id', 'Cloud API phone number ID' ) . '<label>Cloud API access token<input type="password" name="s[wa_token]" value="' . esc_attr( $o['wa_token'] ) . '" autocomplete="off"></label>' . $text( 'wa_template', 'Template name' ) . $text( 'wa_template_lang', 'Template language code', 'text', 'e.g. en, en_US, ml' ); // phpcs:ignore
		echo '</div></div>';

		echo '<div class="dlms-panel"><h2>Students\' experience</h2><div class="dlms-checks">';
		echo $check( 'lang_switch', 'Show the EN / മലയാളം switch' ) . $check( 'protect_enabled', 'Protect lesson pages (no right-click, no copy)' ) . $check( 'watermark_enabled', 'Watermark videos with the student\'s name and phone' ) . $check( 'pwa_enabled', 'Installable app (Add to Home screen)' ); // phpcs:ignore
		echo '</div><div class="dlms-form-grid"><label>Default language<select name="s[default_lang]"><option value="en"' . selected( $o['default_lang'], 'en', false ) . '>English</option><option value="ml"' . selected( $o['default_lang'], 'ml', false ) . '>മലയാളം</option></select></label>' . $text( 'max_upload_mb', 'Max assignment upload (MB)', 'number' ) . '</div></div>'; // phpcs:ignore

		echo '<p class="dlms-sticky"><button class="button button-primary button-hero">Save settings</button></p></form>';
		echo '<div class="dlms-panel"><h2>Pages</h2><p>Verify certificates: <a href="' . esc_url( DLMS_Certificates::verify_url() ) . '" target="_blank">' . esc_html( DLMS_Certificates::verify_url() ) . '</a><br>Learning hub: <a href="' . esc_url( dlms_hub_url() ) . '" target="_blank">' . esc_html( dlms_hub_url() ) . '</a></p></div></div>';
	}

	/**
	 * Save settings.
	 */
	public static function save_settings() {
		check_admin_referer( 'dlms_save_settings' );
		if ( ! dlms_is_admin() ) {
			wp_die( 'Not allowed', 403 );
		}
		$in       = wp_unslash( (array) ( $_POST['s'] ?? array() ) ); // phpcs:ignore WordPress.Security.ValidatedSanitizedInput
		$defaults = dlms_default_settings();
		$out      = array();
		foreach ( $defaults as $k => $def ) {
			if ( ! array_key_exists( $k, $in ) || in_array( $k, array( 'google_refresh', 'google_email' ), true ) ) {
				continue;
			}
			$v = $in[ $k ];
			if ( is_int( $def ) ) {
				$out[ $k ] = (int) $v;
			} elseif ( 'brand_color' === $k ) {
				$out[ $k ] = sanitize_hex_color( $v ) ? sanitize_hex_color( $v ) : $def;
			} elseif ( 'logo_url' === $k ) {
				$out[ $k ] = esc_url_raw( $v );
			} elseif ( 'support_email' === $k ) {
				$out[ $k ] = sanitize_email( $v );
			} elseif ( 'whatsapp' === $k ) {
				$out[ $k ] = dlms_wa_number( $v );
			} else {
				$out[ $k ] = sanitize_text_field( $v );
			}
		}
		$out['receipt_next'] = max( 1, (int) ( $out['receipt_next'] ?? 1 ) );
		dlms_update_opts( $out );
		DLMS_Payments::back( 'dlms-settings', 'Settings saved.' );
	}
}
