angular.module('classeur.optional.planChooser', [])
	.config(
		function($routeProvider) {
			$routeProvider
				.when('/choosePlan', {
					template: '<cl-plan-chooser></cl-plan-chooser>',
					controller: function(clAnalytics) {
						clAnalytics.trackPage('/choosePlan');
					}
				})
				.when('/checkoutSuccess', {
					template: '',
					controller: function($location, clDialog, $timeout) {
						$location.url('/');
						$timeout(function() {
							clDialog.show(clDialog.confirm()
								.title('Thank you!')
								.content('Your premium account will be active in a minute.')
								.ok('Ok'));
						});
					}
				});
		})
	.directive('clPlanChooser',
		function($window, $location, $timeout, clDialog, clUserSvc) {
			return {
				restrict: 'E',
				templateUrl: 'optional/planChooser/planChooser.html',
				link: link
			};

			function link(scope) {
				if (clUserSvc.user) {
					if (!clUserSvc.isUserPremium()) {
						scope.subscribeLink = clUserSvc.getSubscribeLink();
					} else {
						var unsubscribeLink = clUserSvc.getUnsubscribeLink();
						scope.unsubscribe = function() {
							clDialog.show(clDialog.confirm()
									.title('Cancel subscription')
									.content('You are about to be redirected to your PayPal account page. After canceling your subscription, your premium account will remain active until the end of the billing period.')
									.ok('Ok')
									.cancel('Cancel'))
								.then(function() {
									$window.location.href = unsubscribeLink;
								});
						};
					}
				}

				scope.signout = function() {
					$location.url('/');
					$timeout(clUserSvc.signout);
				};
			}
		});
