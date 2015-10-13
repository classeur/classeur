angular.module('classeur.core.analytics', [])
	.config(
		function(AnalyticsProvider) {
			AnalyticsProvider
				.setAccount(window.CL_CONFIG.googleAnalyticsTrackingId)
				.startOffline(true)
				.trackPages(false);
		})
	.factory('clAnalytics',
		function(Analytics, clUserActivity, clIsNavigatorOnline) {
			var scriptLoaded;
			function checkOnline() {
				var isOnline = clIsNavigatorOnline();
				Analytics.offline(!isOnline);
				if(isOnline && !scriptLoaded) {
					Analytics.createAnalyticsScriptTag();
					scriptLoaded = true;
				}
			}
			setInterval(checkOnline, 5 * 1000);
			checkOnline();

			setInterval(function() {
				if(clUserActivity.checkActivity()) {
					Analytics.trackEvent('user', 'activity');
				}
			}, 4 * 60 * 1000);

			return {
				trackPage: function(page) {
					Analytics.trackPage(page, 'Classeur');
				}
			};
		});
