angular.module('classeur.optional.helpDialog', [])
	.run(function($rootScope, clDialog) {
		$rootScope.$on('clHelpDialog', function() {
			clDialog.show({
				templateUrl: 'optional/helpDialog/helpDialog.html',
				onComplete: function(scope) {
					scope.close = function() {
						clDialog.cancel();
					};
				}
			});
		});
	});
