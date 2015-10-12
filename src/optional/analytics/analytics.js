angular.module('classeur.optional.analytics', [])
	.config(
		function(AnalyticsProvider) {
			AnalyticsProvider
				.setAccount(window.CL_CONFIG.googleAnalyticsTrackingId)
				.startOffline(true)
				.trackPages(false);
		})
	.run(
		function(Analytics, clIsNavigatorOnline) {
			var scriptLoaded;
			function checkOnline() {
				var isOnline = clIsNavigatorOnline();
				Analytics.offline(!isOnline);
				if(isOnline && !scriptLoaded) {
					Analytics.createAnalyticsScriptTag();
					scriptLoaded = true;
				}
			}
			setInterval(checkOnline, 5000);
			checkOnline();
		});
