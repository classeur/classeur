angular.module('classeur.core.layoutLight', [
	'famous.angular',
	'classeur.core.settings',
])
	.directive('clLayoutLight', function(layout, settings, editor) {

		return {
			restrict: 'E',
			templateUrl: 'app/core/layoutLight/layoutLight.html',
			link: function(scope) {
				scope.layout = layout;
				scope.settings = settings;
				scope.editor = editor;
			}
		};
	})
	.factory('layout', function($rootScope, settings) {
		settings.setDefaultValue('zoom', 3);

		var layout = {
			pageMargin: 25,
			sideButtonWidth: 40,
			menuWidth: 320,
			tocWidth: 250,
			statHeight: 30,
			gutterWidth: 120,
			isEditorOpen: true,
			toggleEditor: function(isOpen) {
				this.isEditorOpen = isOpen === undefined ? !this.isEditorOpen : isOpen;
			},
			toggleSidePreview: function(isOpen) {
				this.isSidePreviewOpen = isOpen === undefined ? !this.isSidePreviewOpen : isOpen;
			},
			toggleMenu: function() {
				this.currentControl = this.currentControl === 'menu' ? undefined : 'menu';
			},
			toggleToc: function(isOpen) {
				this.isTocOpen = isOpen === undefined ? !this.isTocOpen : isOpen;
			},
			toggleStat: function(isOpen) {
				this.isStatOpen = isOpen === undefined ? !this.isStatOpen : isOpen;
			},
			toggleFolding: function(isOpen) {
				this.isFoldingOpen = isOpen === undefined ? !this.isFoldingOpen : isOpen;
			},
		};

		window.addEventListener('keydown', function(e) {
			if(e.which === 27) {
				// Esc key
				e.preventDefault();
				layout.currentControl = undefined;
				$rootScope.$apply();
			}
		});

		return layout;
	});
