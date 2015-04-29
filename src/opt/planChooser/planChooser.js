angular.module('classeur.opt.planChooser', [])
	.config(function($routeProvider) {
		$routeProvider.when('/choosePlan', {
			template: '<cl-plan-chooser></cl-plan-chooser>'
		}).when('/checkoutSuccess', {
			template: '',
				controller: function($location, $mdDialog, $timeout) {
					$location.url('/');
					$timeout(function() {
						$mdDialog.show($mdDialog.confirm()
								.title('Thank you!')
								.content('Your premium account will be active in a minute.')
								.ok('Ok'));
					});
				}
		});
	})
	.directive('clPlanChooser', function(clUserSvc) {
		return {
			restrict: 'E',
			templateUrl: 'opt/planChooser/planChooser.html',
			link: function(scope) {
				if (clUserSvc.user) {
					var params = {
						cmd: '_s-xclick',
						hosted_button_id: 'GQHCGWH49AEYE',
						custom: clUserSvc.user.id
					};
					scope.subscribeLink = 'https://www.sandbox.paypal.com/cgi-bin/webscr?';
					scope.subscribeLink += Object.keys(params).map(function(key) {
						return key + '=' + encodeURIComponent(params[key]);
					}).join('&');
				}
			}
		};
	});
