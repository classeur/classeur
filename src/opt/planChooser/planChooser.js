angular.module('classeur.opt.planChooser', [])
	.config(function($routeProvider) {
		$routeProvider.when('/choosePlan', {
			template: '<cl-plan-chooser></cl-plan-chooser>'
		}).when('/checkoutSuccess', {
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
	.directive('clPlanChooser', function($window, clDialog, clUserSvc) {
		return {
			restrict: 'E',
			templateUrl: 'opt/planChooser/planChooser.html',
			link: function(scope) {
				if (clUserSvc.user) {
					if (clUserSvc.user.roles.indexOf('premium_user') === -1) {
						scope.subscribeLink = clUserSvc.getSubscribeLink();
					} else {
						var unsubscribeLink = clUserSvc.getUnsubscribeLink();
						scope.unsubscribe = function() {
							clDialog.show(clDialog.confirm()
									.title('Cancel subscription')
									.content('Your are about to be redirected to your PayPal account page. After canceling your subscription, your premium account will remain active until the end of the billing period.')
									.ok('Ok')
									.cancel('Cancel'))
								.then(function() {
									$window.location.href = unsubscribeLink;
								});
						};
					}
				}
			}
		};
	});
