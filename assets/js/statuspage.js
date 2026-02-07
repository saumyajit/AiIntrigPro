(function($) {
    'use strict';
    
    const StatusPage = {
        init: function() {
            this.bindEvents();
            this.initializeTooltips();
        },
        
        bindEvents: function() {
            // Icon size change
            $('#icon-size').on('change', (e) => {
                this.changeIconSize($(e.target).val());
            });
            
            // Spacing change
            $('#spacing').on('change', (e) => {
                this.changeSpacing($(e.target).val());
            });
            
            // Refresh button
            $('#refresh-btn').on('click', () => {
                this.refreshData();
            });
            
            // Host icon interactions
            $(document).on('click', '.host-icon', (e) => {
                this.onHostClick($(e.currentTarget));
            });
            
            $(document).on('mouseenter', '.host-icon', (e) => {
                this.onHostHover($(e.currentTarget));
            });
            
            // Keyboard shortcuts
            $(document).on('keydown', (e) => {
                if ((e.ctrlKey || e.metaKey) && e.key === 'r') {
                    e.preventDefault();
                    this.refreshData();
                }
            });
        },
        
        changeIconSize: function(size) {
            window.location.href = '?action=statuspage.view&icon_size=' + size;
        },
        
        changeSpacing: function(spacing) {
            window.location.href = '?action=statuspage.view&spacing=' + spacing;
        },
        
        refreshData: function() {
            $('.loading-overlay').fadeIn(200);
            window.location.href = '?action=statuspage.view&refresh=1';
        },
        
        onHostClick: function($icon) {
            const hostId = $icon.data('host-id');
            if (hostId) {
                window.open('zabbix.php?action=host.edit&hostid=' + hostId, '_blank');
            }
        },
        
        onHostHover: function($icon) {
            // Add hover effects if needed
            $icon.addClass('hover-active');
            
            // Remove after mouse leave
            $icon.on('mouseleave', function() {
                $(this).removeClass('hover-active');
            });
        },
        
        initializeTooltips: function() {
            // Initialize tooltips if jQuery UI is available
            if ($.fn.tooltip) {
                $('.host-icon').tooltip({
                    track: true,
                    show: { effect: 'fade', duration: 200 },
                    hide: { effect: 'fade', duration: 200 }
                });
            }
        }
    };
    
    // Initialize when document is ready
    $(document).ready(function() {
        StatusPage.init();
    });
    
})(jQuery);
