// Automagically adds/removes default text to a form input
jQuery.fn.defaultText = function(){
    
    // Do stuff!
    this.each(function(){
        var that = jQuery(this);
        
        // Make sure this element has the data
        var datum = that.data('defaultText');
        if (typeof(datum) !== 'undefined') {
            // We need handlers for focus and blur
            that.focus(function(){
                var that = jQuery(this)
                if (that.val() === that.data('defaultText')) {
                    that.val('');
                }
            }).blur(function(){
                var that = jQuery(this)
                if (that.val() === '') {
                    that.val(that.data('defaultText'));
                }
            }).trigger('blur');
        }
    });

    return this;
}