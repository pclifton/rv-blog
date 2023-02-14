<?php
/*
Plugin Name: Category Total
Plugin URI: http://rv9a.pacificrimsound.com/
Description: This plugin adds up a custom field for each post in a category and displays it in the category list.  Updated for version 2.5 table structure.
Author: Dave Parsons (dualrudder.com), updated by Joshua Wyatt
Version: 2.0
Author URI: http://rv9a.pacificrimsound.com/
*/ 

class category_total {
	
	function filter_add_total($content, $category = null) {
		// This function will be called by list_cats() with a category object as the second 
		// parameter for every category in the list.
		
		global $wpdb;
		
		// Set this value to the key of the custom field to total
		$cat_total_field = 'Hours';
		
		// Set this to zero to disable the overall total at the bottom of the category list
		$print_overall_total = 1;
		
		// Set this value to the text to display after the overall total value
		$cat_total_desc = 'hours';

		$now = current_time('mysql', 1);
		
		if ($category == null) {
			if ($print_overall_total) {
				// Print total overall hours
				$cat_total = $wpdb->get_var("SELECT 
				  SUM(pm.meta_value)
					FROM $wpdb->posts
					INNER JOIN $wpdb->postmeta AS pm ON (pm.post_id = ID)
					WHERE pm.meta_key = '$cat_total_field'
					AND post_status = 'publish'
					AND post_date_gmt < '$now'");
				return $content . "<li>Total = $cat_total $cat_total_desc</li>";
			}
			else {
				return $content;
			}
		}
		
		// Print total hours for a specific category
		$cat_total = $wpdb->get_var("SELECT 
		  SUM(pm.meta_value)
			FROM $wpdb->term_relationships AS tr
			INNER JOIN $wpdb->posts ON (ID = tr.object_id)
			INNER JOIN $wpdb->postmeta AS pm ON (pm.post_id = ID)
			WHERE term_taxonomy_id = '{$category->cat_ID}'
			AND pm.meta_key = '$cat_total_field'
			AND post_status = 'publish'
			AND post_date_gmt < '$now'");
		
		if ($cat_total != '') {
			$cat_total = " ($cat_total)";
		}

  	return $content . $cat_total;
	}
}

add_filter('list_cats', array('category_total', 'filter_add_total'), 10, 2);

function category_metatotal($cat_total_field, $cat_total_desc) {
	//Returns totals for an integer custom field defined in the function call
	global $wpdb;
	$now = current_time('mysql', 1);

	$cat_total = $wpdb->get_var("SELECT 
		SUM(pm.meta_value)
		FROM $wpdb->posts
		INNER JOIN $wpdb->postmeta AS pm ON (pm.post_id = ID)
		WHERE pm.meta_key = '$cat_total_field'
		AND post_status = 'publish'
		AND post_date_gmt < '$now'");
	echo "Total = $cat_total $cat_total_desc";
}

function category_overall_total() {
	global $wpdb;

	$now = current_time('mysql', 1);
	
	// Print total overall hours
	$cat_total = $wpdb->get_var("SELECT 
	  SUM(pm.meta_value)
		FROM $wpdb->posts
		INNER JOIN $wpdb->postmeta AS pm ON (pm.post_id = ID)
		WHERE pm.meta_key = 'hours'
		AND post_status = 'publish'
		AND post_date_gmt < '$now'");
		
	return "$cat_total hours logged overall";
}

?>