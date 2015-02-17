angular.module('classeur.extensions.socialIcon', [])
	.directive('clSocialIcon', function($window) {
		var colors = {
			facebook:  '3B5998',
			twitterbird:  '00ACED'
		};
		return {
			restrict: 'E',
			template: '<div class="social icon"><span class=\'symbol\'></span></div>',
			link: function(scope, element, attr) {
				var divElt = element[0].getElementsByTagName('div')[0];
    			divElt.style.backgroundColor = '#' + colors[attr.name];
    			var spanElt = element[0].getElementsByTagName('span')[0];
    			spanElt.textContent = attr.name;
    			divElt.style.color = '#fff';
			}
		};
	});
