<?php
/**
 * Tutor dashboard page: My Learning Hub.
 *
 * @package DartsLMS
 */

defined( 'ABSPATH' ) || exit;
?>
<div class="dlms-dashboard-hub">
	<h3 class="dlms-hub-title"><?php dlms_e( 'My Learning Hub' ); ?></h3>
	<?php echo DLMS_Hub::html( get_current_user_id() ); // phpcs:ignore WordPress.Security.EscapeOutput ?>
</div>
