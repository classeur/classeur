angular.module('classeur.core.layout', [
	'famous.angular',
	'classeur.services.settings',
])
	.directive('layout', function() {
		return {
			restrict: 'E',
			templateUrl: 'app/extensions/scrollSync/scrollSyncSettings.html'
		};
	})
	.factory('layout', function($famous, $rootScope, settings, cledit) {
		var Transitionable = $famous['famous/transitions/Transitionable'];
		var layout = {
			isEditorOpen: true
		};
		var previewSizeAdjust = 150;
		var transX;

		function getBinderSize() {
			transX = document.body.clientWidth/2;
			layout.fontSize = 3;
			var factor = 1 + (settings.values.zoom - 3) * 0.1;
			layout.pageWidth = 960 * factor;
			if(document.body.clientWidth < 1120 * factor) {
				layout.fontSize = 2;
				layout.pageWidth = 880 * factor;
			}
			if(document.body.clientWidth < 1040 * factor) {
				layout.pageWidth = 800 * factor;
			}
			if(document.body.clientWidth + 30 < layout.pageWidth) {
				layout.pageWidth = document.body.clientWidth + 30;
			}
			if(layout.pageWidth < 640 * factor) {
				layout.fontSize = 1;
			}
			if(layout.isSidePreviewOpen && document.body.clientWidth / 2 + 80 < layout.pageWidth) {
				layout.pageWidth = document.body.clientWidth / 2 + 80;
			}
			return [
				layout.pageWidth,
				undefined
			];
		}

		function getPreviewSize() {
			return [
				layout.pageWidth - previewSizeAdjust + 8000,
				undefined
			];
		}

		function getBinderTrans() {
			return [
				transX + (layout.isSidePreviewOpen ? -layout.pageWidth / 2 + 10 : -55),
				0
			];
		}

		function getPreviewTrans() {
			return [
				transX + (layout.isSidePreviewOpen ? (layout.pageWidth - previewSizeAdjust) / 2 + 70 : 0),
				0
			];
		}

		function getEditorTrans() {
			return [
				0,
				layout.isEditorOpen ? 0 : 2200
			];
		}

		function getPageTrans() {
			return [
				layout.isMenuOpen ? -menuWidth : 0,
				layout.isMenuOpen ? -80 : 0
			];
		}

		function getPageOuterTrans() {
			return [
				layout.isMenuOpen ? 10 : 0,
				0
			];
		}

		function getPageRot() {
			return [
				0,
				0,
				layout.isMenuOpen ? -0.03 : 0
			];
		}

		layout.pageMargin = 25;
		layout.binderSize = new Transitionable(getBinderSize());
		layout.binderTrans = new Transitionable(getBinderTrans());
		layout.previewSize = new Transitionable(getPreviewSize());
		layout.previewTrans = new Transitionable(getPreviewTrans());
		layout.editorTrans = new Transitionable(getEditorTrans());
		layout.fontSizeClass = 'font-size-' + layout.fontSize;
		layout.zoomClass = 'zoom-' + settings.values.zoom;
		layout.pageTrans = new Transitionable(getPageTrans());
		layout.pageOuterTrans = new Transitionable(getPageOuterTrans());
		layout.pageRot = new Transitionable(getPageRot());

		function setPreviewTransition() {
			var binderSize = getBinderSize();
			layout.binderTrans.set(getBinderTrans(), {duration: 180, curve: 'easeOut'}, function() {
				layout.fontSizeClass = 'font-size-' + layout.fontSize;
				layout.zoomClass = 'zoom-' + settings.values.zoom;
				$rootScope.$apply();
				layout.binderSize.set(binderSize, {duration: 180, curve: 'custom'});
			});
			var previewSize = getPreviewSize();
			layout.previewTrans.set(getPreviewTrans(), {duration: 180, curve: 'easeOut'}, function() {
				layout.previewSize.set(previewSize, {duration: 180, curve: 'custom'});
			});
		}

		function setEditorTransition() {
			layout.editorTrans.set(getEditorTrans(), {duration: 270, curve: layout.isEditorOpen ? 'easeOut' : 'easeIn'}, function() {
				layout.toggleSidePreview(false);
				layout.toggleMenu(false);
			});
		}

		var menuWidth = 320;
		function setMenuTransition() {
			layout.isReady = true;
			layout.pageTrans.set(getPageTrans(), {duration: 180, curve: 'easeOutBounce'});
			layout.pageOuterTrans.set(getPageOuterTrans(), {duration: 180, curve: 'easeOutBounce'});
			layout.pageRot.set(getPageRot(), {duration: 180, curve: 'easeOutBounce'});
		}

		window.addEventListener('resize', window.ced.Utils.debounce(setPreviewTransition, 400));

		layout.toggleSidePreview = function(isOpen) {
			isOpen = isOpen === undefined ? !layout.isSidePreviewOpen : isOpen;
			if(isOpen != layout.isSidePreviewOpen) {
				layout.isSidePreviewOpen = isOpen;
				onToggleSidePreview(isOpen);
				setPreviewTransition();
			}
		};

		var onToggleEditor = window.ced.Utils.createHook(layout, 'onToggleEditor');
		layout.toggleEditor = function(isOpen) {
			isOpen = isOpen === undefined ? !layout.isEditorOpen : isOpen;
			if(isOpen != layout.isEditorOpen) {
				layout.isEditorOpen = isOpen;
				cledit.editor.toggleEditable(isOpen);
				onToggleEditor(isOpen);
				setEditorTransition();
			}
		};

		var onToggleMenu = window.ced.Utils.createHook(layout, 'onToggleMenu');
		layout.toggleMenu = function(isOpen) {
			isOpen = isOpen === undefined ? !layout.isMenuOpen : isOpen;
			if(isOpen != layout.isMenuOpen) {
				layout.isMenuOpen = isOpen;
				onToggleMenu(isOpen);
				setMenuTransition();
			}
		};

		layout.applyZoom = setPreviewTransition;

		return layout;
	});
