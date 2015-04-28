angular.module('classeur.opt.planChooser', [])
	.config(function($routeProvider) {
		$routeProvider.when('/choosePlan', {
			template: '<cl-plan-chooser></cl-plan-chooser>'
		});
	})
	.directive('clPlanChooser', function() {
		return {
			restrict: 'E',
			templateUrl: 'opt/planChooser/planChooser.html',
			link: function(scope) {
				scope.subscribeLink = 'https://www.sandbox.paypal.com/cgi-bin/webscr?cmd=_s-xclick&hosted_button_id=GQHCGWH49AEYE&rm=2&custom=abc';
			}
		};
	});
