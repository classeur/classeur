angular.module('classeur.services.layout', [
	'famous.angular',
	'classeur.services.settings',
])
	.factory('layout', function($famous, $rootScope, settings, btnBar, cleditor) {
		var Transitionable = $famous['famous/transitions/Transitionable'];
		var layout = {
			isEditorOpen: true
		};
		var previewSizeAdjust = 130;
		var fontSize, transX;

		function getBinderSize() {
			transX = document.body.clientWidth/2;
			fontSize = 3;
			var factor = 1 + (settings.zoom - 3) * 0.1;
			layout.pageWidth = 960 * factor;
			if(document.body.clientWidth < 1120 * factor) {
				fontSize = 2;
				layout.pageWidth = 880 * factor;
			}
			if(document.body.clientWidth < 1040 * factor) {
				layout.pageWidth = 800 * factor;
			}
			if(document.body.clientWidth - 50 < layout.pageWidth) {
				layout.pageWidth = document.body.clientWidth;
			}
			if(layout.pageWidth < 720 * factor) {
				fontSize = 1;
			}
			if(layout.isPreviewOpen && document.body.clientWidth / 2 + 50 < layout.pageWidth) {
				layout.pageWidth = document.body.clientWidth / 2 + 50;
			}
			btnBar.setPageWidth(layout.pageWidth);
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
				transX + (layout.isPreviewOpen ? -layout.pageWidth / 2 + 10 : -40),
				0
			];
		}

		function getPreviewTrans() {
			return [
				transX + (layout.isPreviewOpen ? (layout.pageWidth - previewSizeAdjust) / 2 + 70 : -20),
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
		layout.fontSizeClass = 'font-size-' + fontSize;
		layout.zoomClass = 'zoom-' + settings.zoom;
		layout.pageTrans = new Transitionable(getPageTrans());
		layout.pageOuterTrans = new Transitionable(getPageOuterTrans());
		layout.pageRot = new Transitionable(getPageRot());

		var onLayoutResized = window.ced.Utils.createHook(layout, 'onLayoutResized');
		var oldPageWidth, oldPreviewWidth, oldZoom;
		var checkLayoutResized = window.ced.Utils.debounce(function() {
			var previewWidth = getPreviewSize()[0];
			if(layout.pageWidth != oldPageWidth || previewWidth != oldPreviewWidth || settings.zoom != oldZoom) {
				oldPageWidth = layout.pageWidth;
				oldPreviewWidth = previewWidth;
				oldZoom = settings.zoom;
				onLayoutResized();
			}
		}, 50);

		function setPreviewTransition() {
			var binderSize = getBinderSize();
			layout.binderTrans.set(getBinderTrans(), {duration: 180, curve: 'easeOut'}, function() {
				layout.fontSizeClass = 'font-size-' + fontSize;
				layout.zoomClass = 'zoom-' + settings.zoom;
				$rootScope.$apply();
				layout.binderSize.set(binderSize, {duration: 180, curve: 'custom'}, checkLayoutResized);
			});
			var previewSize = getPreviewSize();
			layout.previewTrans.set(getPreviewTrans(), {duration: 180, curve: 'easeOut'}, function() {
				layout.previewSize.set(previewSize, {duration: 180, curve: 'custom'}, checkLayoutResized);
			});
		}

		function setEditorTransition() {
			layout.editorTrans.set(getEditorTrans(), {duration: 270, curve: layout.isEditorOpen ? 'easeOut' : 'easeIn'}, function() {
				layout.togglePreview(false);
				layout.toggleMenu(false);
			});
		}

		var menuWidth = 320;
		function setMenuTransition() {
			layout.pageTrans.set(getPageTrans(), {duration: 180, curve: 'easeOutBounce'});
			layout.pageOuterTrans.set(getPageOuterTrans(), {duration: 180, curve: 'easeOutBounce'});
			layout.pageRot.set(getPageRot(), {duration: 180, curve: 'easeOutBounce'});
		}

		window.addEventListener('resize', window.ced.Utils.debounce(setPreviewTransition, 400));

		var onTogglePreview = window.ced.Utils.createHook(layout, 'onTogglePreview');
		layout.togglePreview = function(isOpen) {
			isOpen = isOpen === undefined ? !layout.isPreviewOpen : isOpen;
			if(isOpen != layout.isPreviewOpen) {
				layout.isPreviewOpen = isOpen;
				onTogglePreview(isOpen);
				setPreviewTransition();
			}
		};

		var onToggleEditor = window.ced.Utils.createHook(layout, 'onToggleEditor');
		layout.toggleEditor = function(isOpen) {
			isOpen = isOpen === undefined ? !layout.isEditorOpen : isOpen;
			if(isOpen != layout.isEditorOpen) {
				layout.isEditorOpen = isOpen;
				cleditor.editor.toggleEditable(isOpen);
				onToggleEditor(isOpen);
				btnBar.setEditorOpen(isOpen);
				setEditorTransition();
			}
		};

		layout.toggleMenu = function(isOpen) {
			isOpen = isOpen === undefined ? !layout.isMenuOpen : isOpen;
			if(isOpen != layout.isMenuOpen) {
				layout.isMenuOpen = isOpen;
				btnBar.setMenuOpen(layout.isMenuOpen);
				setMenuTransition();
			}
		};

		layout.applyZoom = setPreviewTransition;

		return layout;
	});
