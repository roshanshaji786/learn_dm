<?php
/**
 * Live classes on Google Meet, recordings and attendance.
 *
 * @package DartsLMS
 */

defined( 'ABSPATH' ) || exit;

/**
 * Live classes.
 */
class DLMS_Live {

	/**
	 * Lesson boxes already printed.
	 *
	 * @var array
	 */
	private static $printed = array();

	/**
	 * Init.
	 */
	public static function init() {
		add_action( 'tutor_lesson_before_the_content', array( __CLASS__, 'print_box' ), 5 );
		add_filter( 'the_content', array( __CLASS__, 'content_fallback' ), 5 );
		add_action( 'admin_post_dlms_join', array( __CLASS__, 'handle_join' ) );
		add_action( 'admin_post_dlms_google_connect', array( __CLASS__, 'google_connect' ) );
		add_action( 'admin_post_dlms_google_callback', array( __CLASS__, 'google_callback' ) );
		add_action( 'admin_post_dlms_google_disconnect', array( __CLASS__, 'google_disconnect' ) );
		add_action( 'admin_post_dlms_create_meet', array( __CLASS__, 'handle_create_meet' ) );
		add_action( 'admin_post_dlms_save_attendance', array( __CLASS__, 'handle_save_attendance' ) );
	}

	/**
	 * Live start timestamp.
	 *
	 * @param int $lesson_id Lesson.
	 */
	public static function start_ts( $lesson_id ) {
		return dlms_local_to_ts( dlms_meta( $lesson_id, 'live_start' ) );
	}

	/**
	 * End timestamp.
	 *
	 * @param int $lesson_id Lesson.
	 */
	public static function end_ts( $lesson_id ) {
		$dur = (int) dlms_meta( $lesson_id, 'live_duration' );
		return self::start_ts( $lesson_id ) + ( $dur ? $dur : 60 ) * MINUTE_IN_SECONDS;
	}

	/**
	 * State: upcoming | open | live | ended | none.
	 *
	 * @param int $lesson_id Lesson.
	 */
	public static function state( $lesson_id ) {
		$start = self::start_ts( $lesson_id );
		if ( ! $start ) {
			return 'none';
		}
		$now  = time();
		$open = $start - (int) dlms_opt( 'join_before_min' ) * MINUTE_IN_SECONDS;
		$end  = self::end_ts( $lesson_id ) + 15 * MINUTE_IN_SECONDS;
		if ( $now < $open ) {
			return 'upcoming';
		}
		if ( $now < $start ) {
			return 'open';
		}
		if ( $now <= $end ) {
			return 'live';
		}
		return 'ended';
	}

	/**
	 * Upcoming live lessons for a set of courses.
	 *
	 * @param int[] $course_ids Courses.
	 * @param int   $limit      Max.
	 */
	public static function upcoming( $course_ids, $limit = 10 ) {
		if ( ! $course_ids ) {
			return array();
		}
		$out = array();
		foreach ( $course_ids as $cid ) {
			foreach ( dlms_course_lessons( $cid ) as $l ) {
				$start = self::start_ts( $l->ID );
				if ( $start && self::end_ts( $l->ID ) + 15 * MINUTE_IN_SECONDS >= time() ) {
					$out[] = array(
						'lesson' => $l,
						'course' => $cid,
						'start'  => $start,
					);
				}
			}
		}
		usort( $out, fn( $a, $b ) => $a['start'] <=> $b['start'] );
		return array_slice( $out, 0, $limit );
	}

	/**
	 * All live lessons in a course.
	 *
	 * @param int $course_id Course.
	 */
	public static function course_live_lessons( $course_id ) {
		return array_values( array_filter( dlms_course_lessons( $course_id ), fn( $l ) => (bool) dlms_meta( $l->ID, 'live_start' ) ) );
	}

	/**
	 * Join URL (logs attendance, then redirects to Meet).
	 *
	 * @param int $lesson_id Lesson.
	 */
	public static function join_url( $lesson_id ) {
		return add_query_arg(
			array(
				'action' => 'dlms_join',
				'lesson' => $lesson_id,
			),
			admin_url( 'admin-post.php' )
		);
	}

	/**
	 * Google Calendar "add event" link.
	 *
	 * @param int $lesson_id Lesson.
	 */
	public static function gcal_link( $lesson_id ) {
		$fmt = 'Ymd\THis\Z';
		return add_query_arg(
			array(
				'action'   => 'TEMPLATE',
				'text'     => rawurlencode( get_the_title( $lesson_id ) . ' – ' . dlms_opt( 'academy_name' ) ),
				'dates'    => gmdate( $fmt, self::start_ts( $lesson_id ) ) . '/' . gmdate( $fmt, self::end_ts( $lesson_id ) ),
				'details'  => rawurlencode( get_permalink( $lesson_id ) ),
				'location' => rawurlencode( 'Google Meet' ),
			),
			'https://calendar.google.com/calendar/render'
		);
	}

	/**
	 * Embed HTML for a recording URL (YouTube, Drive, Vimeo, or a link).
	 *
	 * @param string $url URL.
	 */
	public static function embed( $url ) {
		if ( preg_match( '~(?:youtube\.com/(?:watch\?v=|live/|embed/|shorts/)|youtu\.be/)([A-Za-z0-9_-]{6,})~', $url, $m ) ) {
			$src = 'https://www.youtube-nocookie.com/embed/' . $m[1] . '?rel=0&modestbranding=1';
		} elseif ( preg_match( '~drive\.google\.com/file/d/([A-Za-z0-9_-]+)~', $url, $m ) ) {
			$src = 'https://drive.google.com/file/d/' . $m[1] . '/preview';
		} elseif ( preg_match( '~vimeo\.com/(\d+)~', $url, $m ) ) {
			$src = 'https://player.vimeo.com/video/' . $m[1];
		} else {
			return '<p><a class="dlms-btn" href="' . esc_url( $url ) . '" target="_blank" rel="noopener">' . esc_html( dlms_t( 'Watch recording' ) ) . '</a></p>';
		}
		return '<div class="dlms-video dlms-protect-zone"><iframe src="' . esc_url( $src ) . '" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen loading="lazy" referrerpolicy="strict-origin-when-cross-origin"></iframe></div>';
	}

	/**
	 * The live class / recording box for a lesson.
	 *
	 * @param int $lesson_id Lesson.
	 */
	public static function box( $lesson_id ) {
		$html = '';
		$rec  = dlms_meta( $lesson_id, 'recording_url' );
		if ( dlms_meta( $lesson_id, 'live_start' ) ) {
			$state = self::state( $lesson_id );
			$start = self::start_ts( $lesson_id );
			$html .= '<div class="dlms-live dlms-live-' . esc_attr( $state ) . '" data-start="' . esc_attr( $start ) . '" data-open="' . esc_attr( $start - (int) dlms_opt( 'join_before_min' ) * 60 ) . '">';
			$html .= '<div class="dlms-live-head"><span class="dlms-pill">' . esc_html( dlms_t( 'Live class' ) ) . '</span> <strong>' . esc_html( dlms_date( $start ) ) . '</strong>';
			$html .= ' <span class="dlms-muted">(' . (int) ( dlms_meta( $lesson_id, 'live_duration' ) ? dlms_meta( $lesson_id, 'live_duration' ) : 60 ) . ' min)</span></div>';
			if ( 'ended' === $state ) {
				$html .= '<p class="dlms-muted">' . esc_html( dlms_t( 'This class has ended.' ) ) . '</p>';
				if ( ! $rec ) {
					$html .= '<p class="dlms-muted">' . esc_html( dlms_t( 'The recording will appear here after the class.' ) ) . '</p>';
				}
			} elseif ( 'upcoming' === $state ) {
				$html .= '<p>' . esc_html( dlms_t( 'Starts in' ) ) . ' <strong class="dlms-countdown" data-to="' . esc_attr( $start ) . '"></strong></p>';
				$html .= '<p><button class="dlms-btn" disabled>' . esc_html( dlms_t( 'Join live class' ) ) . '</button> <a class="dlms-link" href="' . esc_url( self::gcal_link( $lesson_id ) ) . '" target="_blank" rel="noopener">' . esc_html( dlms_t( 'Add to Google Calendar' ) ) . '</a></p>';
				$html .= '<p class="dlms-muted">' . esc_html( sprintf( dlms_t( 'Join opens %d minutes before the class.' ), (int) dlms_opt( 'join_before_min' ) ) ) . '</p>';
			} else {
				$html .= '<p><strong class="dlms-live-dot">' . esc_html( dlms_t( 'Class is live now' ) ) . '</strong></p>';
				$html .= '<p><a class="dlms-btn dlms-btn-live" href="' . esc_url( self::join_url( $lesson_id ) ) . '" target="_blank" rel="noopener">' . esc_html( dlms_t( 'Join live class' ) ) . '</a></p>';
			}
			$html .= '</div>';
		}
		if ( $rec ) {
			$html .= '<div class="dlms-recording"><h3>' . esc_html( dlms_t( 'Recording' ) ) . '</h3>' . self::embed( $rec ) . '</div>';
		}
		return $html;
	}

	/**
	 * Print boxes before the lesson content (Tutor hook).
	 *
	 * @param WP_Post $post Post.
	 */
	public static function print_box( $post = null ) {
		$id = $post instanceof WP_Post ? $post->ID : get_the_ID();
		if ( isset( self::$printed[ $id ] ) ) {
			return;
		}
		self::$printed[ $id ] = true;
		echo self::box( $id ) . DLMS_Assignments::box( $id ); // phpcs:ignore WordPress.Security.EscapeOutput
	}

	/**
	 * Fallback for Tutor templates that skip the hook.
	 *
	 * @param string $content Content.
	 */
	public static function content_fallback( $content ) {
		if ( ! in_the_loop() || ! is_singular( dlms_lesson_pt() ) || doing_action( 'tutor_lesson_before_the_content' ) ) {
			return $content;
		}
		$id = get_the_ID();
		if ( isset( self::$printed[ $id ] ) ) {
			return $content;
		}
		self::$printed[ $id ] = true;
		return self::box( $id ) . DLMS_Assignments::box( $id ) . $content;
	}

	/**
	 * Join redirect + attendance.
	 */
	public static function handle_join() {
		$lesson_id = absint( $_GET['lesson'] ?? 0 );
		if ( ! is_user_logged_in() ) {
			auth_redirect();
		}
		$uid       = get_current_user_id();
		$course_id = dlms_lesson_course( $lesson_id );
		$link      = dlms_meta( $lesson_id, 'meet_link' );
		if ( ! $course_id || ! $link ) {
			wp_safe_redirect( get_permalink( $lesson_id ) );
			exit;
		}
		$manager = dlms_can_manage_course( $course_id );
		if ( ! $manager ) {
			if ( ! dlms_is_enrolled( $course_id, $uid ) || DLMS_Access::lock( $lesson_id, $uid ) ) {
				wp_safe_redirect( get_permalink( $lesson_id ) );
				exit;
			}
			$state = self::state( $lesson_id );
			if ( 'upcoming' === $state || 'ended' === $state ) {
				wp_safe_redirect( get_permalink( $lesson_id ) );
				exit;
			}
			DLMS_DB::mark_attendance( $lesson_id, $uid, 'auto' );
		}
		wp_redirect( $link ); // phpcs:ignore WordPress.Security.SafeRedirect -- external Meet link set by admin.
		exit;
	}

	/* ---------- Attendance (admin) ---------- */

	/**
	 * Save manual attendance ticks for a lesson.
	 */
	public static function handle_save_attendance() {
		check_admin_referer( 'dlms_save_attendance' );
		$lesson_id = absint( $_POST['lesson_id'] ?? 0 );
		$course_id = dlms_lesson_course( $lesson_id );
		if ( ! dlms_can_manage_course( $course_id ) ) {
			wp_die( 'Not allowed', 403 );
		}
		$present = array_map( 'absint', (array) ( $_POST['present'] ?? array() ) );
		$current = DLMS_DB::attendance_for_lesson( $lesson_id );
		foreach ( dlms_course_students( $course_id ) as $uid ) {
			if ( in_array( $uid, $present, true ) && ! isset( $current[ $uid ] ) ) {
				DLMS_DB::mark_attendance( $lesson_id, $uid, 'manual' );
			} elseif ( ! in_array( $uid, $present, true ) && isset( $current[ $uid ] ) ) {
				DLMS_DB::unmark_attendance( $lesson_id, $uid );
			}
		}
		DLMS_Payments::back( 'dlms-live', 'Attendance saved.', array( 'lesson' => $lesson_id ) );
	}

	/* ---------- Google Calendar / Meet ---------- */

	/**
	 * OAuth redirect URI.
	 */
	public static function redirect_uri() {
		return admin_url( 'admin-post.php?action=dlms_google_callback' );
	}

	/**
	 * Start OAuth.
	 */
	public static function google_connect() {
		check_admin_referer( 'dlms_google_connect' );
		if ( ! dlms_is_admin() || ! dlms_opt( 'google_client_id' ) ) {
			wp_die( 'Add the Google client ID and secret in Settings first.' );
		}
		$state = wp_generate_password( 24, false );
		set_transient( 'dlms_google_state_' . get_current_user_id(), $state, 15 * MINUTE_IN_SECONDS );
		$url = add_query_arg(
			array(
				'client_id'     => rawurlencode( dlms_opt( 'google_client_id' ) ),
				'redirect_uri'  => rawurlencode( self::redirect_uri() ),
				'response_type' => 'code',
				'scope'         => rawurlencode( 'https://www.googleapis.com/auth/calendar.events openid email' ),
				'access_type'   => 'offline',
				'prompt'        => 'consent',
				'state'         => $state,
			),
			'https://accounts.google.com/o/oauth2/v2/auth'
		);
		wp_redirect( $url ); // phpcs:ignore WordPress.Security.SafeRedirect
		exit;
	}

	/**
	 * OAuth callback.
	 */
	public static function google_callback() {
		if ( ! dlms_is_admin() ) {
			wp_die( 'Not allowed', 403 );
		}
		$state = sanitize_text_field( wp_unslash( $_GET['state'] ?? '' ) );
		if ( ! $state || get_transient( 'dlms_google_state_' . get_current_user_id() ) !== $state ) {
			wp_die( 'Google sign-in expired. Go back to Settings and click Connect again.' );
		}
		delete_transient( 'dlms_google_state_' . get_current_user_id() );
		$code = sanitize_text_field( wp_unslash( $_GET['code'] ?? '' ) );
		$res  = wp_remote_post(
			'https://oauth2.googleapis.com/token',
			array(
				'timeout' => 20,
				'body'    => array(
					'code'          => $code,
					'client_id'     => dlms_opt( 'google_client_id' ),
					'client_secret' => dlms_opt( 'google_secret' ),
					'redirect_uri'  => self::redirect_uri(),
					'grant_type'    => 'authorization_code',
				),
			)
		);
		$body = json_decode( wp_remote_retrieve_body( $res ), true );
		if ( empty( $body['refresh_token'] ) ) {
			DLMS_Payments::back( 'dlms-settings', 'Google did not return a refresh token: ' . ( $body['error_description'] ?? $body['error'] ?? 'unknown error' ), array( 'dlms_err' => 1 ) );
		}
		$email = '';
		if ( ! empty( $body['id_token'] ) ) {
			$parts = explode( '.', $body['id_token'] );
			$claims = json_decode( base64_decode( strtr( $parts[1] ?? '', '-_', '+/' ) ), true ); // phpcs:ignore
			$email  = $claims['email'] ?? '';
		}
		dlms_update_opts(
			array(
				'google_refresh' => $body['refresh_token'],
				'google_email'   => sanitize_email( $email ),
			)
		);
		set_transient( 'dlms_google_access', $body['access_token'], max( 60, (int) $body['expires_in'] - 60 ) );
		DLMS_Payments::back( 'dlms-settings', 'Google Calendar connected' . ( $email ? ' as ' . $email : '' ) . '. New live classes can get a Meet link automatically.' );
	}

	/**
	 * Disconnect Google.
	 */
	public static function google_disconnect() {
		check_admin_referer( 'dlms_google_disconnect' );
		if ( ! dlms_is_admin() ) {
			wp_die( 'Not allowed', 403 );
		}
		dlms_update_opts(
			array(
				'google_refresh' => '',
				'google_email'   => '',
			)
		);
		delete_transient( 'dlms_google_access' );
		DLMS_Payments::back( 'dlms-settings', 'Google disconnected.' );
	}

	/**
	 * Access token (refreshing when needed).
	 *
	 * @return string|WP_Error
	 */
	public static function access_token() {
		$t = get_transient( 'dlms_google_access' );
		if ( $t ) {
			return $t;
		}
		if ( ! dlms_opt( 'google_refresh' ) ) {
			return new WP_Error( 'dlms_google', 'Google Calendar is not connected.' );
		}
		$res  = wp_remote_post(
			'https://oauth2.googleapis.com/token',
			array(
				'timeout' => 20,
				'body'    => array(
					'client_id'     => dlms_opt( 'google_client_id' ),
					'client_secret' => dlms_opt( 'google_secret' ),
					'refresh_token' => dlms_opt( 'google_refresh' ),
					'grant_type'    => 'refresh_token',
				),
			)
		);
		$body = json_decode( wp_remote_retrieve_body( $res ), true );
		if ( empty( $body['access_token'] ) ) {
			return new WP_Error( 'dlms_google', 'Google token refresh failed: ' . ( $body['error_description'] ?? $body['error'] ?? 'unknown' ) );
		}
		set_transient( 'dlms_google_access', $body['access_token'], max( 60, (int) $body['expires_in'] - 60 ) );
		return $body['access_token'];
	}

	/**
	 * Create (or update) a Calendar event with a Meet link for a lesson.
	 *
	 * @param int $lesson_id Lesson.
	 * @return string|WP_Error Meet link.
	 */
	public static function create_meet( $lesson_id ) {
		$start = self::start_ts( $lesson_id );
		if ( ! $start ) {
			return new WP_Error( 'dlms_google', 'Set the class date and time first.' );
		}
		$token = self::access_token();
		if ( is_wp_error( $token ) ) {
			return $token;
		}
		$tz    = wp_timezone_string();
		$event = array(
			'summary'        => get_the_title( $lesson_id ) . ' – ' . get_the_title( dlms_lesson_course( $lesson_id ) ),
			'description'    => 'Lesson page: ' . get_permalink( $lesson_id ),
			'start'          => array(
				'dateTime' => wp_date( 'c', $start ),
				'timeZone' => $tz,
			),
			'end'            => array(
				'dateTime' => wp_date( 'c', self::end_ts( $lesson_id ) ),
				'timeZone' => $tz,
			),
			'conferenceData' => array(
				'createRequest' => array(
					'requestId'             => 'dlms-' . $lesson_id . '-' . time(),
					'conferenceSolutionKey' => array( 'type' => 'hangoutsMeet' ),
				),
			),
		);
		$event_id = dlms_meta( $lesson_id, 'gcal_event' );
		$url      = 'https://www.googleapis.com/calendar/v3/calendars/primary/events' . ( $event_id ? '/' . rawurlencode( $event_id ) : '' ) . '?conferenceDataVersion=1';
		$res      = wp_remote_request(
			$url,
			array(
				'method'  => $event_id ? 'PATCH' : 'POST',
				'timeout' => 20,
				'headers' => array(
					'Authorization' => 'Bearer ' . $token,
					'Content-Type'  => 'application/json',
				),
				'body'    => wp_json_encode( $event ),
			)
		);
		$body     = json_decode( wp_remote_retrieve_body( $res ), true );
		if ( empty( $body['id'] ) ) {
			return new WP_Error( 'dlms_google', 'Google Calendar error: ' . ( $body['error']['message'] ?? 'no response' ) );
		}
		update_post_meta( $lesson_id, '_dlms_gcal_event', sanitize_text_field( $body['id'] ) );
		$link = $body['hangoutLink'] ?? '';
		if ( ! $link && ! empty( $body['conferenceData']['entryPoints'] ) ) {
			foreach ( $body['conferenceData']['entryPoints'] as $ep ) {
				if ( 'video' === ( $ep['entryPointType'] ?? '' ) ) {
					$link = $ep['uri'];
				}
			}
		}
		if ( $link ) {
			update_post_meta( $lesson_id, '_dlms_meet_link', esc_url_raw( $link ) );
			return $link;
		}
		return new WP_Error( 'dlms_google', 'The event was created but Google did not add a Meet link yet. Try again in a minute.' );
	}

	/**
	 * Admin action: create Meet link.
	 */
	public static function handle_create_meet() {
		check_admin_referer( 'dlms_create_meet' );
		$lesson_id = absint( $_GET['lesson'] ?? 0 );
		$course_id = dlms_lesson_course( $lesson_id );
		if ( ! dlms_can_manage_course( $course_id ) ) {
			wp_die( 'Not allowed', 403 );
		}
		$r = self::create_meet( $lesson_id );
		if ( is_wp_error( $r ) ) {
			DLMS_Payments::back( 'dlms-course', $r->get_error_message(), array( 'course' => $course_id, 'dlms_err' => 1 ) );
		}
		DLMS_Payments::back( 'dlms-course', 'Meet link created: ' . $r, array( 'course' => $course_id ) );
	}
}
