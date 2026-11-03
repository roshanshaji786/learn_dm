<?php
/**
 * WhatsApp send center: send a link or message to students' WhatsApp numbers
 * and to WhatsApp groups, from the dashboard.
 *
 * Two modes:
 * - One-tap (free, default): the dashboard prepares a personal message for each
 *   student and opens WhatsApp with it filled in; you tap Send. Groups open the
 *   WhatsApp share picker with the message ready.
 * - Automatic (optional): sends to student numbers through the official
 *   WhatsApp Cloud API with an approved template. Meta charges per message.
 *   Groups are never sent automatically (no safe, allowed way to do that).
 *
 * @package DartsLMS
 */

defined( 'ABSPATH' ) || exit;

/**
 * WhatsApp.
 */
class DLMS_WhatsApp {

	/**
	 * Init.
	 */
	public static function init() {
		add_action( 'admin_post_dlms_wa_create', array( __CLASS__, 'handle_create' ) );
		add_action( 'admin_post_dlms_wa_save_groups', array( __CLASS__, 'handle_save_groups' ) );
		add_action( 'admin_post_dlms_wa_delete', array( __CLASS__, 'handle_delete' ) );
		add_action( 'wp_ajax_dlms_wa_mark', array( __CLASS__, 'ajax_mark' ) );
		add_action( 'dlms_wa_process', array( __CLASS__, 'process_api_queue' ) );
	}

	/**
	 * Saved groups: [ ['id'=>..., 'name'=>..., 'invite'=>...], ... ].
	 */
	public static function groups() {
		$g = get_option( 'dlms_wa_groups', array() );
		return is_array( $g ) ? array_values( $g ) : array();
	}

	/**
	 * Is the Cloud API set up.
	 */
	public static function api_ready() {
		return 'api' === dlms_opt( 'wa_mode' ) && dlms_opt( 'wa_phone_id' ) && dlms_opt( 'wa_token' ) && dlms_opt( 'wa_template' );
	}

	/**
	 * Fill placeholders.
	 *
	 * @param string $text Template text.
	 * @param array  $vars Vars.
	 */
	public static function fill( $text, $vars ) {
		$map = array();
		foreach ( $vars as $k => $v ) {
			$map[ '{' . $k . '}' ] = (string) $v;
		}
		// Groups have no name: "Hi {first_name}," becomes "Hi everyone,".
		if ( empty( $vars['first_name'] ) && empty( $vars['name'] ) ) {
			$text = preg_replace( '/\{(first_name|name)\}/', 'everyone', $text );
		}
		$out = strtr( $text, $map );
		// Drop placeholders that had no value (e.g. {name} in a group message).
		$out = preg_replace( '/\{(name|first_name|course|link|amount|due)\}/', '', $out );
		return trim( preg_replace( "/[ \t]+\n/", "\n", $out ) );
	}

	/**
	 * Recipients for an audience.
	 *
	 * @param string $audience course|due|overdue|users.
	 * @param int    $course_id Course.
	 * @param int[]  $user_ids  Picked users.
	 * @return int[]
	 */
	public static function audience_users( $audience, $course_id, $user_ids = array() ) {
		switch ( $audience ) {
			case 'course':
				return $course_id ? dlms_course_students( $course_id ) : array();
			case 'all':
				global $wpdb;
				return array_map( 'intval', $wpdb->get_col( "SELECT DISTINCT post_author FROM {$wpdb->posts} WHERE post_type = 'tutor_enrolled' AND post_status = 'completed'" ) );
			case 'due':
			case 'overdue':
				$out = array();
				foreach ( DLMS_DB::fees(
					array(
						'course_id' => $course_id,
						'only_due'  => true,
					)
				) as $f ) {
					if ( 'due' === $audience || DLMS_DB::is_overdue( $f ) ) {
						$out[] = (int) $f->user_id;
					}
				}
				return array_values( array_unique( $out ) );
			case 'users':
				return array_values( array_filter( array_map( 'intval', $user_ids ) ) );
		}
		return array();
	}

	/**
	 * Create a send (campaign) and its queue.
	 */
	public static function handle_create() {
		check_admin_referer( 'dlms_wa_create' );
		$course_id = absint( $_POST['course'] ?? 0 );
		if ( $course_id ? ! dlms_can_manage_course( $course_id ) : ! dlms_is_admin() ) {
			wp_die( 'Not allowed', 403 );
		}
		$message  = sanitize_textarea_field( wp_unslash( $_POST['message'] ?? '' ) );
		$link     = esc_url_raw( wp_unslash( $_POST['link'] ?? '' ) );
		$audience = sanitize_key( $_POST['audience'] ?? 'course' );
		$users    = array_map( 'absint', (array) ( $_POST['users'] ?? array() ) );
		$groups   = array_map( 'sanitize_key', (array) ( $_POST['groups'] ?? array() ) );
		$auto     = ! empty( $_POST['auto'] ) && self::api_ready();
		if ( ! $message ) {
			DLMS_Payments::back( 'dlms-whatsapp', 'Write a message first.', array( 'dlms_err' => 1 ) );
		}
		if ( $link && false === strpos( $message, '{link}' ) ) {
			$message .= "\n{link}";
		}
		$user_ids = 'none' === $audience ? array() : self::audience_users( $audience, $course_id, $users );
		if ( ! dlms_is_admin() ) {
			// Instructors only reach their own students.
			$user_ids = array_values( array_intersect( $user_ids, $course_id ? dlms_course_students( $course_id ) : array() ) );
		}
		if ( ! $user_ids && ! $groups ) {
			DLMS_Payments::back( 'dlms-whatsapp', 'No one to send to. Pick a course with students, some students, or a group.', array( 'dlms_err' => 1 ) );
		}

		global $wpdb;
		$campaign = wp_generate_password( 10, false, false );
		$now      = current_time( 'mysql' );
		$course   = $course_id ? get_the_title( $course_id ) : '';
		foreach ( $user_ids as $uid ) {
			$phone = dlms_user_phone( $uid );
			$fee   = $course_id ? DLMS_DB::fee( $uid, $course_id ) : null;
			$name  = dlms_user_name( $uid );
			$text  = self::fill(
				$message,
				array(
					'name'       => $name,
					'first_name' => strtok( $name, ' ' ),
					'course'     => $course,
					'link'       => $link,
					'amount'     => $fee ? dlms_money( DLMS_DB::balance( $fee ) ) : '',
					'due'        => $fee && $fee->due_date ? mysql2date( 'j M', $fee->due_date ) : '',
				)
			);
			$wpdb->insert(
				DLMS_DB::t( 'wa_queue' ),
				array(
					'campaign'   => $campaign,
					'kind'       => 'user',
					'user_id'    => $uid,
					'target'     => dlms_wa_number( $phone ),
					'label'      => $name,
					'message'    => $text,
					'link'       => $link,
					'status'     => $phone ? ( $auto ? 'queued' : 'pending' ) : 'no_phone',
					'created_at' => $now,
					'created_by' => get_current_user_id(),
				)
			);
		}
		$all_groups = self::groups();
		foreach ( $all_groups as $g ) {
			if ( ! in_array( $g['id'], $groups, true ) ) {
				continue;
			}
			$wpdb->insert(
				DLMS_DB::t( 'wa_queue' ),
				array(
					'campaign'   => $campaign,
					'kind'       => 'group',
					'user_id'    => 0,
					'target'     => $g['invite'],
					'label'      => $g['name'],
					'message'    => self::fill(
						$message,
						array(
							'course' => $course,
							'link'   => $link,
						)
					),
					'link'       => $link,
					'status'     => 'pending',
					'created_at' => $now,
					'created_by' => get_current_user_id(),
				)
			);
		}
		if ( $auto ) {
			self::process_api_queue( $campaign );
		}
		DLMS_Payments::back( 'dlms-whatsapp', $auto ? 'Sending through WhatsApp Cloud API. Groups below still need one tap each.' : 'Ready. Tap "Open WhatsApp" on each row (or use "Send next").', array( 'campaign' => $campaign ) );
	}

	/**
	 * Send queued rows through the Cloud API (25 per run; the rest continue by cron).
	 *
	 * @param string $campaign Campaign (empty = any).
	 */
	public static function process_api_queue( $campaign = '' ) {
		if ( ! self::api_ready() ) {
			return;
		}
		global $wpdb;
		$t    = DLMS_DB::t( 'wa_queue' );
		$rows = $campaign
			? $wpdb->get_results( $wpdb->prepare( "SELECT * FROM $t WHERE status = 'queued' AND campaign = %s ORDER BY id LIMIT 25", $campaign ) ) // phpcs:ignore WordPress.DB.PreparedSQL
			: $wpdb->get_results( "SELECT * FROM $t WHERE status = 'queued' ORDER BY id LIMIT 25" ); // phpcs:ignore WordPress.DB.PreparedSQL
		foreach ( $rows as $r ) {
			$res = self::api_send( $r->target, $r->label, $r->link ? $r->link : home_url( '/' ) );
			$wpdb->update(
				$t,
				array(
					'status'  => is_wp_error( $res ) ? 'failed' : 'sent',
					'error'   => is_wp_error( $res ) ? substr( $res->get_error_message(), 0, 250 ) : '',
					'sent_at' => current_time( 'mysql' ),
				),
				array( 'id' => $r->id )
			);
		}
		$left = (int) $wpdb->get_var( "SELECT COUNT(*) FROM $t WHERE status = 'queued'" ); // phpcs:ignore WordPress.DB.PreparedSQL
		if ( $left && ! wp_next_scheduled( 'dlms_wa_process' ) ) {
			wp_schedule_single_event( time() + 60, 'dlms_wa_process' );
		}
	}

	/**
	 * One template message via the WhatsApp Cloud API.
	 * The template must have two body variables: {{1}} = name, {{2}} = link.
	 *
	 * @param string $to   Number with country code.
	 * @param string $name Name.
	 * @param string $link Link.
	 * @return true|WP_Error
	 */
	public static function api_send( $to, $name, $link ) {
		$url  = 'https://graph.facebook.com/v21.0/' . rawurlencode( dlms_opt( 'wa_phone_id' ) ) . '/messages';
		$body = array(
			'messaging_product' => 'whatsapp',
			'to'                => $to,
			'type'              => 'template',
			'template'          => array(
				'name'       => dlms_opt( 'wa_template' ),
				'language'   => array( 'code' => dlms_opt( 'wa_template_lang' ) ? dlms_opt( 'wa_template_lang' ) : 'en' ),
				'components' => array(
					array(
						'type'       => 'body',
						'parameters' => array(
							array(
								'type' => 'text',
								'text' => $name ? $name : 'there',
							),
							array(
								'type' => 'text',
								'text' => $link,
							),
						),
					),
				),
			),
		);
		$res  = wp_remote_post(
			$url,
			array(
				'timeout' => 20,
				'headers' => array(
					'Authorization' => 'Bearer ' . dlms_opt( 'wa_token' ),
					'Content-Type'  => 'application/json',
				),
				'body'    => wp_json_encode( $body ),
			)
		);
		if ( is_wp_error( $res ) ) {
			return $res;
		}
		$data = json_decode( wp_remote_retrieve_body( $res ), true );
		if ( ! empty( $data['messages'][0]['id'] ) ) {
			return true;
		}
		return new WP_Error( 'dlms_wa', $data['error']['message'] ?? 'WhatsApp API error' );
	}

	/**
	 * Mark a row sent/skipped (one-tap mode).
	 */
	public static function ajax_mark() {
		check_ajax_referer( 'dlms_wa_mark' );
		global $wpdb;
		$id  = absint( $_POST['id'] ?? 0 );
		$row = $wpdb->get_row( $wpdb->prepare( 'SELECT * FROM ' . DLMS_DB::t( 'wa_queue' ) . ' WHERE id = %d', $id ) ); // phpcs:ignore WordPress.DB.PreparedSQL
		if ( ! $row || ( (int) $row->created_by !== get_current_user_id() && ! dlms_is_admin() ) ) {
			wp_send_json_error( null, 403 );
		}
		$status = 'skipped' === sanitize_key( $_POST['status'] ?? '' ) ? 'skipped' : 'sent';
		$wpdb->update(
			DLMS_DB::t( 'wa_queue' ),
			array(
				'status'  => $status,
				'sent_at' => current_time( 'mysql' ),
			),
			array( 'id' => $id )
		);
		wp_send_json_success( array( 'status' => $status ) );
	}

	/**
	 * Save groups.
	 */
	public static function handle_save_groups() {
		check_admin_referer( 'dlms_wa_save_groups' );
		if ( ! dlms_is_admin() ) {
			wp_die( 'Not allowed', 403 );
		}
		$names   = (array) wp_unslash( $_POST['gname'] ?? array() ); // phpcs:ignore WordPress.Security.ValidatedSanitizedInput
		$invites = (array) wp_unslash( $_POST['ginvite'] ?? array() ); // phpcs:ignore WordPress.Security.ValidatedSanitizedInput
		$ids     = (array) wp_unslash( $_POST['gid'] ?? array() ); // phpcs:ignore WordPress.Security.ValidatedSanitizedInput
		$out     = array();
		foreach ( $names as $i => $n ) {
			$n = sanitize_text_field( $n );
			if ( '' === $n ) {
				continue;
			}
			$out[] = array(
				'id'     => ! empty( $ids[ $i ] ) ? sanitize_key( $ids[ $i ] ) : strtolower( wp_generate_password( 8, false, false ) ),
				'name'   => $n,
				'invite' => esc_url_raw( $invites[ $i ] ?? '' ),
			);
		}
		update_option( 'dlms_wa_groups', $out, false );
		DLMS_Payments::back( 'dlms-whatsapp', 'Groups saved.', array( 'tab' => 'groups' ) );
	}

	/**
	 * Delete a campaign's history.
	 */
	public static function handle_delete() {
		check_admin_referer( 'dlms_wa_delete' );
		if ( ! dlms_is_admin() ) {
			wp_die( 'Not allowed', 403 );
		}
		global $wpdb;
		$wpdb->delete( DLMS_DB::t( 'wa_queue' ), array( 'campaign' => sanitize_key( $_GET['campaign'] ?? '' ) ) );
		DLMS_Payments::back( 'dlms-whatsapp', 'Removed from history.' );
	}

	/**
	 * Admin URL to the compose screen, prefilled.
	 *
	 * @param array $args course, link, message.
	 */
	public static function compose_url( $args ) {
		return add_query_arg( array_map( 'rawurlencode', $args ) + array( 'page' => 'dlms-whatsapp' ), admin_url( 'admin.php' ) );
	}

	/* ---------------- Screens ---------------- */

	/**
	 * Admin page.
	 */
	public static function page() {
		$campaign = isset( $_GET['campaign'] ) ? sanitize_key( $_GET['campaign'] ) : ''; // phpcs:ignore WordPress.Security.NonceVerification
		$tab      = isset( $_GET['tab'] ) ? sanitize_key( $_GET['tab'] ) : 'send'; // phpcs:ignore WordPress.Security.NonceVerification
		DLMS_Admin::head( 'WhatsApp' );
		$tabs = array(
			'send'    => 'New message',
			'history' => 'Sent history',
		);
		if ( dlms_is_admin() ) {
			$tabs['groups'] = 'Groups';
		}
		echo '<nav class="nav-tab-wrapper">';
		foreach ( $tabs as $k => $v ) {
			echo '<a class="nav-tab' . ( $k === $tab && ! $campaign ? ' nav-tab-active' : '' ) . '" href="' . esc_url( admin_url( 'admin.php?page=dlms-whatsapp&tab=' . $k ) ) . '">' . esc_html( $v ) . '</a>';
		}
		echo '</nav>';
		if ( $campaign ) {
			self::screen_campaign( $campaign );
		} elseif ( 'groups' === $tab && dlms_is_admin() ) {
			self::screen_groups();
		} elseif ( 'history' === $tab ) {
			self::screen_history();
		} else {
			self::screen_compose();
		}
		echo '</div>';
	}

	/**
	 * Message templates.
	 */
	public static function templates() {
		return array(
			'class'     => "Hi {first_name}, today's live class for {course} starts soon. Join here: {link}",
			'recording' => "Hi {first_name}, the recording of today's {course} class is ready: {link}",
			'material'  => "Hi {first_name}, here is the material for {course}: {link}",
			'payment'   => "Hi {first_name}, a balance of {amount} for {course} is due on {due}. Pay here: {link}",
			'custom'    => '',
		);
	}

	/**
	 * Compose screen.
	 */
	public static function screen_compose() {
		$course  = isset( $_GET['course'] ) ? absint( $_GET['course'] ) : 0; // phpcs:ignore WordPress.Security.NonceVerification
		$link    = isset( $_GET['link'] ) ? esc_url_raw( wp_unslash( rawurldecode( $_GET['link'] ) ) ) : ''; // phpcs:ignore
		$preset  = isset( $_GET['tpl'] ) ? sanitize_key( $_GET['tpl'] ) : 'class'; // phpcs:ignore WordPress.Security.NonceVerification
		$tpls    = self::templates();
		$message = isset( $_GET['message'] ) ? sanitize_textarea_field( wp_unslash( rawurldecode( $_GET['message'] ) ) ) : ( $tpls[ $preset ] ?? $tpls['class'] ); // phpcs:ignore
		$groups  = self::groups();
		$api     = self::api_ready();

		echo '<form method="post" action="' . esc_url( admin_url( 'admin-post.php' ) ) . '" class="dlms-panel dlms-wa-compose">';
		wp_nonce_field( 'dlms_wa_create' );
		echo '<input type="hidden" name="action" value="dlms_wa_create">';
		echo '<div class="dlms-form-grid">';
		echo '<label>Link to send<input type="url" name="link" value="' . esc_attr( $link ) . '" placeholder="https://meet.google.com/… or a lesson, recording, form, payment link"><small>Tip: send the lesson page link for live classes, so attendance is counted when they tap Join.</small></label>';
		echo '<label>Quick template<select data-dlms-tpl>';
		foreach ( array(
			'class'     => 'Live class link',
			'recording' => 'Recording ready',
			'material'  => 'Study material',
			'payment'   => 'Payment reminder',
			'custom'    => 'Blank',
		) as $k => $v ) {
			echo '<option value="' . esc_attr( $k ) . '"' . selected( $preset, $k, false ) . '>' . esc_html( $v ) . '</option>';
		}
		echo '</select></label>';
		echo '<label class="wide">Message<textarea name="message" rows="4" required data-dlms-msg>' . esc_textarea( $message ) . '</textarea><small>Placeholders: {first_name} {name} {course} {link} {amount} {due}. Each student gets their own name; groups get "everyone".</small></label>';
		echo '</div><script>window.DLMS_WA_TPL=' . wp_json_encode( $tpls ) . ';</script>';

		echo '<h3>Send to students</h3><div class="dlms-form-grid">';
		echo '<label>Course' . DLMS_Admin::course_select( $course, 'course', true ) . '</label>'; // phpcs:ignore
		echo '<label>Who<select name="audience" data-dlms-aud>';
		foreach ( array(
			'course'  => 'Everyone in the course',
			'due'     => 'Students with a balance due',
			'overdue' => 'Students who are overdue',
			'users'   => 'Pick students',
			'all'     => 'All students (every course)',
			'none'    => 'No students (groups only)',
		) as $k => $v ) {
			echo '<option value="' . esc_attr( $k ) . '">' . esc_html( $v ) . '</option>';
		}
		echo '</select></label>';
		echo '<label class="wide" data-aud-show="users">Students<select name="users[]" multiple size="8">';
		global $wpdb;
		$ids = $wpdb->get_col( "SELECT DISTINCT post_author FROM {$wpdb->posts} WHERE post_type = 'tutor_enrolled' AND post_status = 'completed'" );
		foreach ( $ids as $uid ) {
			$visible = dlms_is_admin() || array_filter( dlms_user_courses( $uid ), 'dlms_can_manage_course' );
			if ( $visible ) {
				echo '<option value="' . (int) $uid . '">' . esc_html( dlms_user_name( $uid ) . ( dlms_user_phone( $uid ) ? ' · ' . dlms_user_phone( $uid ) : ' · no number' ) ) . '</option>';
			}
		}
		echo '</select><small>Hold Ctrl (or Cmd) to pick several.</small></label></div>';

		echo '<h3>Send to WhatsApp groups</h3>';
		if ( $groups ) {
			echo '<div class="dlms-checks">';
			foreach ( $groups as $g ) {
				echo '<label class="check"><input type="checkbox" name="groups[]" value="' . esc_attr( $g['id'] ) . '"> ' . esc_html( $g['name'] ) . '</label>';
			}
			echo '</div>';
		} else {
			echo '<p class="dlms-muted">No groups saved yet. ' . ( dlms_is_admin() ? '<a href="' . esc_url( admin_url( 'admin.php?page=dlms-whatsapp&tab=groups' ) ) . '">Add your batch groups</a>.' : '' ) . '</p>';
		}

		if ( $api ) {
			echo '<p><label class="check"><input type="checkbox" name="auto" value="1" checked> Send to students automatically through the WhatsApp Cloud API (template "' . esc_html( dlms_opt( 'wa_template' ) ) . '"; Meta charges per message)</label></p>';
		}
		echo '<p><button class="button button-primary button-hero">' . ( $api ? 'Send' : 'Prepare messages' ) . '</button></p>';
		echo '<p class="dlms-muted">' . ( $api ? 'Groups always open WhatsApp for one tap, because WhatsApp does not allow automatic group posting.' : 'Free mode: the next screen opens WhatsApp with each message ready, and you tap Send. Nothing is sent without you.' ) . '</p>';
		echo '</form>';
	}

	/**
	 * One campaign: the tap queue.
	 *
	 * @param string $campaign Campaign.
	 */
	public static function screen_campaign( $campaign ) {
		global $wpdb;
		$rows = $wpdb->get_results( $wpdb->prepare( 'SELECT * FROM ' . DLMS_DB::t( 'wa_queue' ) . ' WHERE campaign = %s ORDER BY kind DESC, id ASC', $campaign ) ); // phpcs:ignore WordPress.DB.PreparedSQL
		if ( ! $rows ) {
			echo '<p>Not found.</p>';
			return;
		}
		$counts = array_count_values( wp_list_pluck( $rows, 'status' ) );
		$total  = count( $rows );
		$done   = ( $counts['sent'] ?? 0 ) + ( $counts['skipped'] ?? 0 );
		echo '<div class="dlms-panel"><div class="dlms-wa-top"><div><strong>' . (int) $done . ' / ' . (int) $total . '</strong> done' . ( ! empty( $counts['no_phone'] ) ? ' · <span class="dlms-err">' . (int) $counts['no_phone'] . ' without a WhatsApp number</span>' : '' ) . ( ! empty( $counts['failed'] ) ? ' · <span class="dlms-err">' . (int) $counts['failed'] . ' failed</span>' : '' ) . ( ! empty( $counts['queued'] ) ? ' · ' . (int) $counts['queued'] . ' sending…' : '' ) . '</div>';
		echo '<button type="button" class="button button-primary" data-dlms-next>Send next ▶</button></div>';
		echo '<div class="dlms-wa-preview"><span class="dlms-muted">Message</span><pre>' . esc_html( $rows[0]->message ) . '</pre></div>';
		echo '<table class="widefat striped dlms-wa-table" data-nonce="' . esc_attr( wp_create_nonce( 'dlms_wa_mark' ) ) . '"><thead><tr><th>To</th><th>Status</th><th></th></tr></thead><tbody>';
		foreach ( $rows as $r ) {
			$st = $r->status;
			echo '<tr data-id="' . (int) $r->id . '" data-status="' . esc_attr( $st ) . '"><td>' . ( 'group' === $r->kind ? '👥 <strong>' . esc_html( $r->label ) . '</strong> <span class="dlms-muted">(group)</span>' : '<strong>' . esc_html( $r->label ) . '</strong><br><span class="dlms-muted">' . esc_html( $r->target ? '+' . $r->target : 'no number' ) . '</span>' ) . '</td>';
			echo '<td class="dlms-wa-st"><span class="dlms-pill dlms-wa-' . esc_attr( $st ) . '">' . esc_html( str_replace( '_', ' ', $st ) ) . '</span>' . ( $r->error ? '<br><small class="dlms-err">' . esc_html( $r->error ) . '</small>' : '' ) . '</td><td class="dlms-wa-actions">';
			if ( 'user' === $r->kind && $r->target && in_array( $st, array( 'pending', 'skipped', 'failed', 'sent' ), true ) ) {
				echo '<a class="button' . ( 'pending' === $st ? ' button-primary' : '' ) . '" data-dlms-open href="' . esc_url( 'https://wa.me/' . $r->target . '?text=' . rawurlencode( $r->message ) ) . '" target="_blank" rel="noopener">Open WhatsApp</a> ';
			} elseif ( 'group' === $r->kind ) {
				echo '<a class="button' . ( 'pending' === $st ? ' button-primary' : '' ) . '" data-dlms-open href="' . esc_url( 'https://wa.me/?text=' . rawurlencode( $r->message ) ) . '" target="_blank" rel="noopener">Open WhatsApp → pick group</a> ';
				echo '<button type="button" class="button" data-dlms-copy="' . esc_attr( $r->message ) . '">Copy text</button> ';
				if ( $r->target ) {
					echo '<a class="button" href="' . esc_url( $r->target ) . '" target="_blank" rel="noopener">Open group</a> ';
				}
			} elseif ( 'no_phone' === $st && $r->user_id ) {
				echo '<a href="' . esc_url( admin_url( 'user-edit.php?user_id=' . $r->user_id ) ) . '">Add number</a> ';
			}
			if ( in_array( $st, array( 'pending' ), true ) ) {
				echo '<button type="button" class="button-link" data-dlms-skip>Skip</button>';
			}
			echo '</td></tr>';
		}
		echo '</tbody></table></div>';
		echo '<p class="dlms-muted">"Open WhatsApp" opens the chat with the message filled in. Tap Send in WhatsApp, then come back for the next one. Rows tick themselves as you go.</p>';
	}

	/**
	 * History.
	 */
	public static function screen_history() {
		global $wpdb;
		$t     = DLMS_DB::t( 'wa_queue' );
		$where = dlms_is_admin() ? '' : $wpdb->prepare( ' WHERE created_by = %d', get_current_user_id() );
		$list  = $wpdb->get_results( "SELECT campaign, MIN(created_at) AS at, MIN(message) AS message, COUNT(*) AS total, SUM(status IN ('sent','skipped')) AS done FROM $t$where GROUP BY campaign ORDER BY at DESC LIMIT 50" ); // phpcs:ignore WordPress.DB.PreparedSQL
		echo '<div class="dlms-panel"><table class="widefat striped"><thead><tr><th>When</th><th>Message</th><th>Done</th><th></th></tr></thead><tbody>';
		if ( ! $list ) {
			echo '<tr><td colspan="4">Nothing sent yet.</td></tr>';
		}
		foreach ( $list as $c ) {
			$del = wp_nonce_url( admin_url( 'admin-post.php?action=dlms_wa_delete&campaign=' . $c->campaign ), 'dlms_wa_delete' );
			echo '<tr><td>' . esc_html( mysql2date( 'j M, g:i A', $c->at ) ) . '</td><td>' . esc_html( wp_trim_words( $c->message, 16 ) ) . '</td><td>' . (int) $c->done . ' / ' . (int) $c->total . '</td><td><a class="button" href="' . esc_url( admin_url( 'admin.php?page=dlms-whatsapp&campaign=' . $c->campaign ) ) . '">Open</a> ' . ( dlms_is_admin() ? '<a class="dlms-del" href="' . esc_url( $del ) . '" onclick="return confirm(\'Remove from history?\')">Remove</a>' : '' ) . '</td></tr>';
		}
		echo '</tbody></table></div>';
	}

	/**
	 * Groups editor.
	 */
	public static function screen_groups() {
		$groups   = self::groups();
		$groups[] = array(
			'id'     => '',
			'name'   => '',
			'invite' => '',
		);
		$groups[] = array(
			'id'     => '',
			'name'   => '',
			'invite' => '',
		);
		echo '<form method="post" action="' . esc_url( admin_url( 'admin-post.php' ) ) . '" class="dlms-panel">';
		wp_nonce_field( 'dlms_wa_save_groups' );
		echo '<input type="hidden" name="action" value="dlms_wa_save_groups">';
		echo '<p>Save the WhatsApp groups you post in, like each batch group. The invite link is optional and only used for the "Open group" button. Leave a name empty to delete that group.</p>';
		echo '<table class="widefat"><thead><tr><th>Group name</th><th>Invite link (optional)</th></tr></thead><tbody>';
		foreach ( $groups as $g ) {
			echo '<tr><td><input type="hidden" name="gid[]" value="' . esc_attr( $g['id'] ) . '"><input type="text" class="regular-text" name="gname[]" value="' . esc_attr( $g['name'] ) . '" placeholder="e.g. AI Business Builder · Batch 1"></td><td><input type="url" class="regular-text" name="ginvite[]" value="' . esc_attr( $g['invite'] ) . '" placeholder="https://chat.whatsapp.com/…"></td></tr>';
		}
		echo '</tbody></table><p><button class="button button-primary">Save groups</button></p></form>';
	}
}
