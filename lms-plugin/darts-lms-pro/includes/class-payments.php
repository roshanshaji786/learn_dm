<?php
/**
 * Manual enrolment, part payments, receipts and WooCommerce/Razorpay sync.
 *
 * @package DartsLMS
 */

defined( 'ABSPATH' ) || exit;

/**
 * Payments.
 */
class DLMS_Payments {

	/**
	 * Payment methods.
	 */
	public static function methods() {
		return array(
			'upi'      => 'UPI',
			'razorpay' => 'Razorpay (online)',
			'bank'     => 'Bank transfer',
			'cash'     => 'Cash',
			'card'     => 'Card',
			'credit'   => 'Course credit',
			'other'    => 'Other',
		);
	}

	/**
	 * Init.
	 */
	public static function init() {
		add_action( 'admin_post_dlms_manual_enrol', array( __CLASS__, 'handle_manual_enrol' ) );
		add_action( 'admin_post_dlms_add_payment', array( __CLASS__, 'handle_add_payment' ) );
		add_action( 'admin_post_dlms_delete_payment', array( __CLASS__, 'handle_delete_payment' ) );
		add_action( 'admin_post_dlms_save_fee', array( __CLASS__, 'handle_save_fee' ) );
		add_action( 'admin_post_dlms_receipt', array( __CLASS__, 'handle_receipt' ) );
		add_action( 'dlms_payment_added', array( __CLASS__, 'email_receipt' ), 10, 2 );
		add_action( 'tutor_after_enrolled', array( __CLASS__, 'ensure_fee_row' ), 5, 2 );

		// WooCommerce (Razorpay plugin) orders.
		add_action( 'woocommerce_order_status_processing', array( __CLASS__, 'wc_order_paid' ), 20 );
		add_action( 'woocommerce_order_status_completed', array( __CLASS__, 'wc_order_paid' ), 20 );
		add_action( 'woocommerce_order_status_refunded', array( __CLASS__, 'wc_order_refunded' ), 20 );
	}

	/**
	 * Redirect back to an admin page with a message.
	 *
	 * @param string $page Page slug.
	 * @param string $msg  Message.
	 * @param array  $args Extra args.
	 */
	public static function back( $page, $msg, $args = array() ) {
		$args['page']     = $page;
		$args['dlms_msg'] = rawurlencode( $msg );
		wp_safe_redirect( add_query_arg( $args, admin_url( 'admin.php' ) ) );
		exit;
	}

	/**
	 * Make sure every enrolment has a fee row (so dues and reports are complete).
	 *
	 * @param int $course_id Course.
	 * @param int $user_id   User.
	 */
	public static function ensure_fee_row( $course_id, $user_id ) {
		if ( DLMS_DB::fee( $user_id, $course_id ) ) {
			return;
		}
		$bundle_parent = (int) get_user_meta( $user_id, '_dlms_bundle_' . $course_id, true );
		$total         = $bundle_parent ? 0 : DLMS_Courses::fee( $course_id );
		DLMS_DB::save_fee( $user_id, $course_id, $total, null, $bundle_parent ? 'Included in ' . get_the_title( $bundle_parent ) : '' );
	}

	/**
	 * Find or create a student account.
	 *
	 * @param string $name  Name.
	 * @param string $email Email.
	 * @param string $phone Phone.
	 * @return array [user_id, is_new]
	 */
	public static function find_or_create_user( $name, $email, $phone ) {
		$user = get_user_by( 'email', $email );
		if ( $user ) {
			if ( $phone ) {
				update_user_meta( $user->ID, 'dlms_phone', $phone );
			}
			return array( $user->ID, false );
		}
		$base  = sanitize_user( current( explode( '@', $email ) ), true );
		$base  = $base ? $base : 'student';
		$login = $base;
		$i     = 1;
		while ( username_exists( $login ) ) {
			$login = $base . $i++;
		}
		$parts   = explode( ' ', trim( $name ), 2 );
		$user_id = wp_insert_user(
			array(
				'user_login'   => $login,
				'user_email'   => $email,
				'user_pass'    => wp_generate_password( 20 ),
				'display_name' => $name,
				'first_name'   => $parts[0] ?? '',
				'last_name'    => $parts[1] ?? '',
				'role'         => get_option( 'default_role', 'subscriber' ),
			)
		);
		if ( is_wp_error( $user_id ) ) {
			return array( 0, false );
		}
		update_user_meta( $user_id, 'dlms_phone', $phone );
		update_user_meta( $user_id, 'billing_phone', $phone );
		return array( $user_id, true );
	}

	/**
	 * Manual enrolment form handler.
	 */
	public static function handle_manual_enrol() {
		check_admin_referer( 'dlms_manual_enrol' );
		$course_id = isset( $_POST['course_id'] ) ? absint( $_POST['course_id'] ) : 0;
		if ( ! dlms_can_manage_course( $course_id ) ) {
			wp_die( 'Not allowed', 403 );
		}
		$name   = sanitize_text_field( wp_unslash( $_POST['name'] ?? '' ) );
		$email  = sanitize_email( wp_unslash( $_POST['email'] ?? '' ) );
		$phone  = sanitize_text_field( wp_unslash( $_POST['phone'] ?? '' ) );
		$total  = (float) ( $_POST['total_fee'] ?? 0 );
		$paid   = (float) ( $_POST['paid_now'] ?? 0 );
		$method = sanitize_key( $_POST['method'] ?? 'upi' );
		$ref    = sanitize_text_field( wp_unslash( $_POST['reference'] ?? '' ) );
		$due    = DLMS_Courses::clean( wp_unslash( $_POST['due_date'] ?? '' ), 'date' );
		$note   = sanitize_text_field( wp_unslash( $_POST['plan_note'] ?? '' ) );
		$paid_on = DLMS_Courses::clean( wp_unslash( $_POST['paid_on'] ?? '' ), 'date' );

		if ( ! $course_id || ! is_email( $email ) || ! $name ) {
			self::back( 'dlms-students', 'Name, a valid email and a course are required.', array( 'dlms_err' => 1 ) );
		}

		list( $user_id, $is_new ) = self::find_or_create_user( $name, $email, $phone );
		if ( ! $user_id ) {
			self::back( 'dlms-students', 'Could not create the student account.', array( 'dlms_err' => 1 ) );
		}

		// Fee row first so the enrol hook does not create a default one.
		$fee_id = DLMS_DB::save_fee( $user_id, $course_id, $total, $due ? $due : null, $note );
		if ( $is_new && ! empty( $_POST['send_welcome'] ) ) {
			// The welcome email already covers the enrolment.
			set_transient( 'dlms_skip_enrol_mail_' . $user_id . '_' . $course_id, 1, 5 * MINUTE_IN_SECONDS );
		}
		if ( empty( $_POST['send_welcome'] ) ) {
			set_transient( 'dlms_skip_enrol_mail_' . $user_id . '_' . $course_id, 1, 5 * MINUTE_IN_SECONDS );
		}
		dlms_enrol( $course_id, $user_id );

		if ( ! empty( $_POST['apply_credit'] ) ) {
			list( $credit, $from ) = DLMS_Courses::credit_for( $course_id, $user_id );
			$already = array_filter( DLMS_DB::payments( $fee_id ), fn( $x ) => 'credit' === $x->method && 'course-' . $from === $x->reference );
			$room    = DLMS_DB::balance( DLMS_DB::fee_by_id( $fee_id ) );
			if ( $credit > 0 && ! $already && $room > 0 ) {
				DLMS_DB::add_payment( $fee_id, min( $credit, $room ), 'credit', 'course-' . $from, 'Credit from ' . get_the_title( $from ) );
			}
		}
		if ( $paid > 0 ) {
			DLMS_DB::add_payment( $fee_id, $paid, $method, $ref, '', $paid_on ? $paid_on . ' ' . wp_date( 'H:i:s' ) : '' );
		}

		if ( $is_new && ! empty( $_POST['send_welcome'] ) && dlms_opt( 'notify_welcome' ) ) {
			DLMS_Notify::welcome( $user_id, $course_id );
		}
		self::back( 'dlms-students', sprintf( '%s is enrolled in %s.', $name, get_the_title( $course_id ) ), array( 'fee' => $fee_id ) );
	}

	/**
	 * Add a payment to an existing fee row.
	 */
	public static function handle_add_payment() {
		check_admin_referer( 'dlms_add_payment' );
		$fee = DLMS_DB::fee_by_id( absint( $_POST['fee_id'] ?? 0 ) );
		if ( ! $fee || ! dlms_can_manage_course( $fee->course_id ) ) {
			wp_die( 'Not allowed', 403 );
		}
		$amount  = (float) ( $_POST['amount'] ?? 0 );
		$method  = sanitize_key( $_POST['method'] ?? 'upi' );
		$ref     = sanitize_text_field( wp_unslash( $_POST['reference'] ?? '' ) );
		$note    = sanitize_text_field( wp_unslash( $_POST['note'] ?? '' ) );
		$paid_on = DLMS_Courses::clean( wp_unslash( $_POST['paid_on'] ?? '' ), 'date' );
		$due     = DLMS_Courses::clean( wp_unslash( $_POST['next_due'] ?? '' ), 'date' );
		if ( $amount <= 0 ) {
			self::back( 'dlms-students', 'Enter an amount above zero.', array( 'fee' => $fee->id, 'dlms_err' => 1 ) );
		}
		DLMS_DB::add_payment( $fee->id, $amount, $method, $ref, $note, $paid_on ? $paid_on . ' ' . wp_date( 'H:i:s' ) : '' );
		$fee = DLMS_DB::fee_by_id( $fee->id );
		DLMS_DB::save_fee( $fee->user_id, $fee->course_id, $fee->total_fee, DLMS_DB::balance( $fee ) > 0 ? ( $due ? $due : $fee->due_date ) : null, $fee->plan_note );
		self::back( 'dlms-students', 'Payment of ' . dlms_money( $amount ) . ' recorded.', array( 'fee' => $fee->id ) );
	}

	/**
	 * Delete a payment.
	 */
	public static function handle_delete_payment() {
		check_admin_referer( 'dlms_delete_payment' );
		$p = DLMS_DB::payment( absint( $_GET['payment'] ?? 0 ) );
		if ( ! $p || ! dlms_is_admin() ) {
			wp_die( 'Not allowed', 403 );
		}
		DLMS_DB::delete_payment( $p->id );
		self::back( 'dlms-students', 'Payment ' . $p->receipt_no . ' deleted.', array( 'fee' => $p->fee_id ) );
	}

	/**
	 * Edit fee plan (total, due date, note).
	 */
	public static function handle_save_fee() {
		check_admin_referer( 'dlms_save_fee' );
		$fee = DLMS_DB::fee_by_id( absint( $_POST['fee_id'] ?? 0 ) );
		if ( ! $fee || ! dlms_can_manage_course( $fee->course_id ) ) {
			wp_die( 'Not allowed', 403 );
		}
		$due = DLMS_Courses::clean( wp_unslash( $_POST['due_date'] ?? '' ), 'date' );
		DLMS_DB::save_fee( $fee->user_id, $fee->course_id, (float) ( $_POST['total_fee'] ?? 0 ), $due ? $due : null, sanitize_text_field( wp_unslash( $_POST['plan_note'] ?? '' ) ) );
		$phone = sanitize_text_field( wp_unslash( $_POST['phone'] ?? '' ) );
		if ( $phone ) {
			update_user_meta( $fee->user_id, 'dlms_phone', $phone );
		}
		self::back( 'dlms-students', 'Fee plan updated.', array( 'fee' => $fee->id ) );
	}

	/**
	 * Receipt HTML.
	 *
	 * @param object $p Payment row.
	 */
	public static function receipt_html( $p ) {
		$fee     = DLMS_DB::fee_by_id( $p->fee_id );
		global $wpdb;
		$paid    = (float) $wpdb->get_var( $wpdb->prepare( 'SELECT COALESCE(SUM(amount),0) FROM ' . DLMS_DB::t( 'payments' ) . ' WHERE fee_id = %d AND ( paid_at < %s OR ( paid_at = %s AND id <= %d ) )', $p->fee_id, $p->paid_at, $p->paid_at, $p->id ) ); // phpcs:ignore WordPress.DB.PreparedSQL
		$balance = $fee ? max( 0, (float) $fee->total_fee - $paid ) : 0;
		$user    = get_userdata( $p->user_id );
		$color   = esc_attr( dlms_opt( 'brand_color' ) );
		$logo    = dlms_logo_data_uri();
		$methods = self::methods();
		$rows    = array(
			'Receipt no.'    => $p->receipt_no,
			'Date'           => mysql2date( 'j M Y', $p->paid_at ),
			'Student'        => dlms_user_name( $p->user_id ),
			'Email'          => $user ? $user->user_email : '',
			'Phone'          => dlms_user_phone( $p->user_id ),
			'Course'         => get_the_title( $p->course_id ),
			'Payment method' => $methods[ $p->method ] ?? $p->method,
			'Reference'      => $p->reference,
		);
		$h       = '<html><head><meta charset="utf-8"><style>
			body{font-family:"DejaVu Sans",sans-serif;color:#1f2937;font-size:12px;margin:0}
			.wrap{padding:36px 44px}
			.head{border-bottom:3px solid ' . $color . ';padding-bottom:14px;margin-bottom:22px}
			.head td{vertical-align:middle}
			h1{font-size:22px;margin:0;color:' . $color . '}
			table.kv{width:100%;border-collapse:collapse;margin-bottom:20px}
			table.kv td{padding:7px 8px;border-bottom:1px solid #e5e7eb}
			table.kv td.k{color:#6b7280;width:34%}
			.amount{background:#f5f3ff;border:1px solid #ddd6fe;border-radius:8px;padding:16px;margin:10px 0 18px}
			.amount .big{font-size:26px;font-weight:bold;color:' . $color . '}
			table.sum{width:100%;border-collapse:collapse}
			table.sum td{padding:6px 8px}
			table.sum td.r{text-align:right}
			.foot{margin-top:36px;color:#6b7280;font-size:10px;border-top:1px solid #e5e7eb;padding-top:10px}
		</style></head><body><div class="wrap">';
		$h      .= '<table class="head" width="100%"><tr><td>' . ( $logo ? '<img src="' . $logo . '" style="max-height:52px">' : '<h1>' . esc_html( dlms_opt( 'academy_name' ) ) . '</h1>' ) . '</td><td style="text-align:right"><h1>Payment receipt</h1><div style="color:#6b7280">' . esc_html( $p->receipt_no ) . '</div></td></tr></table>';
		$h      .= '<div class="amount">Amount received<br><span class="big">' . esc_html( dlms_money( $p->amount ) ) . '</span></div>';
		$h      .= '<table class="kv">';
		foreach ( $rows as $k => $v ) {
			if ( '' !== (string) $v ) {
				$h .= '<tr><td class="k">' . esc_html( $k ) . '</td><td>' . esc_html( $v ) . '</td></tr>';
			}
		}
		$h .= '</table>';
		if ( $fee ) {
			$h .= '<table class="sum"><tr><td>Total course fee</td><td class="r">' . esc_html( dlms_money( $fee->total_fee ) ) . '</td></tr>'
				. '<tr><td>Paid so far (including this receipt)</td><td class="r">' . esc_html( dlms_money( $paid ) ) . '</td></tr>'
				. '<tr><td><strong>Balance</strong></td><td class="r"><strong>' . esc_html( dlms_money( $balance ) ) . '</strong></td></tr>';
			if ( $balance > 0 && $fee->due_date ) {
				$h .= '<tr><td>Balance due by</td><td class="r">' . esc_html( mysql2date( 'j M Y', $fee->due_date ) ) . '</td></tr>';
			}
			$h .= '</table>';
		}
		$h .= '<div class="foot">' . esc_html( dlms_opt( 'academy_name' ) ) . ' · ' . esc_html( home_url() ) . ( dlms_opt( 'whatsapp' ) ? ' · WhatsApp +' . esc_html( dlms_wa_number( dlms_opt( 'whatsapp' ) ) ) : '' ) . '<br>This is a computer-generated receipt and needs no signature.</div>';
		$h .= '</div></body></html>';
		return $h;
	}

	/**
	 * Receipt download (student owns it, or manager).
	 */
	public static function handle_receipt() {
		$p = DLMS_DB::payment( absint( $_GET['payment'] ?? 0 ) );
		if ( ! $p || ! is_user_logged_in() ) {
			auth_redirect();
		}
		if ( (int) $p->user_id !== get_current_user_id() && ! dlms_can_manage_course( $p->course_id ) ) {
			wp_die( 'Not allowed', 403 );
		}
		dlms_send_pdf( dlms_pdf( self::receipt_html( $p ) ), $p->receipt_no . '.pdf' );
	}

	/**
	 * Receipt download URL.
	 *
	 * @param int $payment_id Payment.
	 */
	public static function receipt_url( $payment_id ) {
		return add_query_arg(
			array(
				'action'  => 'dlms_receipt',
				'payment' => $payment_id,
			),
			admin_url( 'admin-post.php' )
		);
	}

	/**
	 * Email receipt PDF.
	 *
	 * @param int    $payment_id Payment.
	 * @param object $fee        Fee row.
	 */
	public static function email_receipt( $payment_id, $fee ) {
		if ( ! dlms_opt( 'notify_receipt' ) ) {
			return;
		}
		$p = DLMS_DB::payment( $payment_id );
		if ( ! $p || 'credit' === $p->method ) {
			return;
		}
		$pdf  = dlms_pdf( self::receipt_html( $p ) );
		$atts = array();
		if ( $pdf ) {
			$file = trailingslashit( get_temp_dir() ) . sanitize_file_name( $p->receipt_no ) . '.pdf';
			file_put_contents( $file, $pdf ); // phpcs:ignore WordPress.WP.AlternativeFunctions
			$atts[] = $file;
		}
		$fee     = DLMS_DB::fee_by_id( $p->fee_id );
		$balance = DLMS_DB::balance( $fee );
		$body    = '<p>' . sprintf( 'Hi %s,', esc_html( dlms_user_name( $p->user_id ) ) ) . '</p>'
			. '<p>' . sprintf( 'We received <strong>%1$s</strong> for <strong>%2$s</strong>. Your receipt %3$s is attached.', esc_html( dlms_money( $p->amount ) ), esc_html( get_the_title( $p->course_id ) ), esc_html( $p->receipt_no ) ) . '</p>'
			. ( $balance > 0 ? '<p>' . sprintf( 'Balance: <strong>%s</strong>', esc_html( dlms_money( $balance ) ) ) . ( $fee->due_date ? ', due by ' . esc_html( mysql2date( 'j M Y', $fee->due_date ) ) : '' ) . '.</p>' : '<p>Your fee is fully paid. Thank you!</p>' )
			. '<p>' . dlms_button( dlms_hub_url(), 'Open my learning hub' ) . '</p>';
		dlms_mail( $p->user_id, 'Receipt ' . $p->receipt_no . ' – ' . get_the_title( $p->course_id ), 'Payment received', $body, $atts );
		foreach ( $atts as $f ) {
			wp_delete_file( $f );
		}
	}

	/**
	 * Course ids linked to a WooCommerce product.
	 *
	 * @param int $product_id Product.
	 * @return int[]
	 */
	public static function courses_for_product( $product_id ) {
		global $wpdb;
		return array_map(
			'intval',
			$wpdb->get_col( $wpdb->prepare( "SELECT post_id FROM {$wpdb->postmeta} WHERE meta_key = '_tutor_course_product_id' AND meta_value = %d", $product_id ) )
		);
	}

	/**
	 * Record a paid WooCommerce order (e.g. Razorpay) in the ledger and enrol.
	 *
	 * @param int $order_id Order.
	 */
	public static function wc_order_paid( $order_id ) {
		$order = wc_get_order( $order_id );
		if ( ! $order || $order->get_meta( '_dlms_synced' ) ) {
			return;
		}
		$user_id = (int) $order->get_customer_id();
		if ( ! $user_id ) {
			return;
		}
		$phone = $order->get_billing_phone();
		if ( $phone && ! get_user_meta( $user_id, 'dlms_phone', true ) ) {
			update_user_meta( $user_id, 'dlms_phone', $phone );
		}
		$synced = false;
		foreach ( $order->get_items() as $item ) {
			$product_id = $item->get_product_id();
			foreach ( self::courses_for_product( $product_id ) as $course_id ) {
				$fee = DLMS_DB::fee( $user_id, $course_id );
				if ( ! $fee ) {
					$total  = (float) $item->get_subtotal();
					$fee_id = DLMS_DB::save_fee( $user_id, $course_id, $total );
				} else {
					$fee_id = (int) $fee->id;
				}
				dlms_enrol( $course_id, $user_id );
				$paid = (float) $item->get_total();
				$disc = round( (float) $item->get_subtotal() - $paid, 2 );
				if ( $disc > 0 ) {
					DLMS_DB::add_payment( $fee_id, $disc, 'credit', 'order-' . $order->get_id(), 'Coupon: ' . implode( ', ', $order->get_coupon_codes() ) );
				}
				if ( $paid > 0 ) {
					DLMS_DB::add_payment( $fee_id, $paid, 'razorpay' === $order->get_payment_method() ? 'razorpay' : 'card', 'order-' . $order->get_id(), $order->get_payment_method_title() );
				}
				$synced = true;
			}
		}
		if ( $synced ) {
			$order->update_meta_data( '_dlms_synced', time() );
			$order->save();
		}
	}

	/**
	 * Remove ledger rows of a refunded order.
	 *
	 * @param int $order_id Order.
	 */
	public static function wc_order_refunded( $order_id ) {
		global $wpdb;
		$wpdb->delete( DLMS_DB::t( 'payments' ), array( 'reference' => 'order-' . (int) $order_id ) );
	}
}
