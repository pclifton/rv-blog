=== Category Total Plugin ===
Tags: category, total, list_cats, wp_list_cats
Contributors: Davepar, Jwyatt

Instead of listing the number of posts in the category list (e.g. "Uncategories (3)"), this plugin will allow you to total any custom field on the posts within a category. For example, say you are using WordPress to document your progress on a project, and you use a custom field called "Hours" to track how many hours you spend on the project for each entry. This plugin can add an hour total to each category in the category list.

For version 2.5 and greater, there is a template tag included to allow you to display the total for all categories for any field.  Insert this code in your template wherever you would like to display the total.
	<?php category_metatotal($cat_total_field, $cat_total_desc); ?>
[ Replace $cat_total_field with the name of the custom field you want to total; $cat_total_desc with the "units" text you want to display.  For example, entering (Hours, hours) for a field named "Hours" returns "Total = xxx.x hours".  BOTH arguments are required. ]

Note: This version h as been edited from the original to allow it to work with the revised table structure in WordPress 2.5.  It likely will not work with older versions.  
For previous versions, please download the 1.0 version by Dave Parsons.  (However, you need WordPress 1.5.1 or greater. There are bugs in 1.5 that prevent this plugin from working properly.)


== Installation of Category Totals ==
1. Copy cat-total.php to wp-content/plugins.
2. Edit cat-total.php to select the custom field to total.
3. Activate the plug-in in the Plugins administration panel.
4. Use either wp_list_categories or wp_list_cats (caution: deprecated tag).
5. You will probably want to remove the "optioncount" parameter (or set it to zero) in the call to wp_list_cats in sidebar.php for your current theme. Otherwise you'll get a post count and custom field total.


== Frequently Asked Questions ==

=== What happens to posts that are assigned to more than one category? ===
The value for that post's custom field will be added to both categories. However, the total tag will only count the post once.