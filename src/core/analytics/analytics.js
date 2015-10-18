angular.module('classeur.core.analytics', [])
	.config(
		function(AnalyticsProvider) {
			window.CL_CONFIG && AnalyticsProvider
				.setAccount(window.CL_CONFIG.googleAnalyticsTrackingId);
			AnalyticsProvider
				.startOffline(true)
				.trackPages(false);
		})
	.factory('clAnalytics',
		function(Analytics, clUserActivity, clIsNavigatorOnline) {
			var reportActivityEvery = 4 * 60 * 1000;
			var scriptTagCreated, lastTracking;

			function tryCreateScriptTag() {
				var isOnline = clIsNavigatorOnline();
				Analytics.offline(!isOnline);
				if (isOnline && !scriptTagCreated) {
					Analytics.createAnalyticsScriptTag();
					scriptTagCreated = true;
				}
			}

			setInterval(function() {
				tryCreateScriptTag();
				var currentDate = Date.now();
				if (clUserActivity.checkActivity() && currentDate - lastTracking > reportActivityEvery) {
					lastTracking = currentDate;
					Analytics.trackEvent('user', 'activity');
				}
			}, 5 * 1000);
			tryCreateScriptTag();

			return {
				trackPage: function(page) {
					lastTracking = Date.now();
					Analytics.trackPage(page, 'Classeur');
				}
			};
		});
