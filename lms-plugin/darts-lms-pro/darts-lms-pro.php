<?php
/**
 * Plugin Name:       Darts LMS Pro
 * Plugin URI:        https://learn.roshanshaji.com
 * Description:       Free add-on for Tutor LMS: live Google Meet classes, recordings, part payments and receipts, drip and prerequisites, assignments, attendance, certificates, gradebook, reminders, bundles and course credit, Malayalam switch, content protection, installable app and an admin dashboard.
 * Version:           1.0.0
 * Requires at least: 6.4
 * Requires PHP:      8.0
 * Requires Plugins:  tutor
 * Author:            Darts AI Academy
 * License:           GPL-2.0-or-later
 * Text Domain:       darts-lms
 *
 * @package DartsLMS
 */

defined( 'ABSPATH' ) || exit;

define( 'DLMS_VERSION', '1.0.0' );
define( 'DLMS_DB_VERSION', '1' );
define( 'DLMS_FILE', __FILE__ );
define( 'DLMS_DIR', plugin_dir_path( __FILE__ ) );
define( 'DLMS_URL', plugin_dir_url( __FILE__ ) );

if ( file_exists( DLMS_DIR . 'vendor/autoload.php' ) ) {
	require_once DLMS_DIR . 'vendor/autoload.php';
}

$dlms_files = array(
	'helpers',
	'class-db',
	'class-i18n',
	'class-courses',
	'class-payments',
	'class-access',
	'class-live',
	'class-assignments',
	'class-certificates',
	'class-reports',
	'class-notify',
	'class-protect',
	'class-pwa',
	'class-hub',
	'class-admin',
);
foreach ( $dlms_files as $dlms_file ) {
	require_once DLMS_DIR . 'includes/' . $dlms_file . '.php';
}

register_activation_hook( __FILE__, array( 'DLMS_DB', 'activate' ) );
register_deactivation_hook( __FILE__, array( 'DLMS_DB', 'deactivate' ) );

add_action(
	'plugins_loaded',
	function () {
		DLMS_DB::maybe_upgrade();
		DLMS_I18n::init();
		DLMS_PWA::init();
		DLMS_Protect::init();
		DLMS_Certificates::init();
		DLMS_Notify::init();

		if ( ! function_exists( 'tutor' ) ) {
			add_action(
				'admin_notices',
				function () {
					echo '<div class="notice notice-error"><p><strong>Darts LMS Pro</strong> needs the free <a href="' . esc_url( admin_url( 'plugin-install.php?s=tutor+lms&tab=search&type=term' ) ) . '">Tutor LMS</a> plugin. Install and activate it first.</p></div>';
				}
			);
			return;
		}

		DLMS_Courses::init();
		DLMS_Payments::init();
		DLMS_Access::init();
		DLMS_Live::init();
		DLMS_Assignments::init();
		DLMS_Reports::init();
		DLMS_Hub::init();
		if ( is_admin() ) {
			DLMS_Admin::init();
		}
	},
	20
);
