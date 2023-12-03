<?php
/**
 * Plugin Name: Extract Content for AI
 * Description: extracts content pages and permalinks for AI ingestion
 * Author: Michael Olivier
 */

$allowed = false;
$requested = false;

// Check if the current user has admin capabilities.
if ( current_user_can( 'manage_options' ) ) { $allowed = true; }

// Check if the user requested the export.
if ( isset($_GET['export_content']) && $_GET['export_content'] == '1' ) { $requested = true; }

if ( $requested && $allowed ) {
    // Get a list of all published content-type posts.
    $args = array(
        'posts_per_page' => -1, // Retrieve all posts.
        'post_status'    => 'publish', // Only the posts that are published.
        'post_type'      => 'content' // Your custom post type.
    );
    $posts = get_posts( $args );

    // Create an exports directory inside wp-content if it doesn't exist.
    $upload_dir = wp_upload_dir();
    $export_dir = $upload_dir['basedir'] . '/exports/';
    if ( ! file_exists( $export_dir ) ) {
        mkdir( $export_dir, 0755, true );
    }

    // Create a ZipArchive to store all the files.
    $zip = new ZipArchive();
    $zip_filename = $export_dir . 'content_exports.zip';

    if ( $zip->open($zip_filename, ZipArchive::CREATE) !== TRUE ) {
        exit("Cannot open <$zip_filename>\n");
    }

    // Loop through each post and create a text file.
    foreach ( $posts as $post ) {
        $permalink = get_permalink( $post->ID );
        $content = "SOURCE: {$permalink}\n\n{$post->post_content}";
        $file_name = 'post-' . $post->ID . '.txt';
        $zip->addFromString($file_name, $content);
    }

    // Close the ZipArchive.
    $zip->close();

    // Provide a direct download link to the ZIP file.
    $zip_url = $upload_dir['baseurl'] . '/exports/content_exports.zip';
    wp_redirect( $zip_url ); // Redirect to the zip file.

    // Stop further execution.
    exit;
}
?>
