jQuery(function(){
    // Default Text thinger
    jQuery('input.defaultText').defaultText();
    
    // Find external links and send 'em to a new tab
    jQuery('a[href]').each(function(){
        if (this.href.indexOf(window.location.protocol + '//' + window.location.host) === -1) {
            this.target = '_blank';
        }
    });
});