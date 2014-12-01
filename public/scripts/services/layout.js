angular.module('classeur.services.layout', [
	'famous.angular',
	'classeur.services.settings',
])
	.factory('layout', function($famous, $rootScope, settings) {
		var Transitionable = $famous['famous/transitions/Transitionable'];
		var layout = {};
		var previewSizeAdjust = 130;
		var fontSize;

		function getBinderSize() {
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
				fontSize = 1;
				layout.pageWidth = document.body.clientWidth - 50;
			}
			if(layout.isPreviewOpen && document.body.clientWidth / 2 + 50 < layout.pageWidth) {
				layout.pageWidth = document.body.clientWidth / 2 + 50;
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
				layout.isPreviewOpen ? -layout.pageWidth / 2 + 10 : -20,
				0
			];
		}

		function getPreviewTrans() {
			return [
				layout.isPreviewOpen ? (layout.pageWidth - previewSizeAdjust) / 2 + 70 : -20,
				0
			];
		}

		layout.pageMargin = 25;
		layout.binderSize = new Transitionable(getBinderSize());
		layout.binderTrans = new Transitionable(getBinderTrans());
		layout.previewSize = new Transitionable(getPreviewSize());
		layout.previewTrans = new Transitionable(getPreviewTrans());
		layout.fontSizeClass = 'font-size-' + fontSize;
		layout.zoomClass = 'zoom-' + settings.zoom;

		function setTransition() {
			var binderSize = getBinderSize();
			layout.binderTrans.set(getBinderTrans(), {duration: 180, curve: 'easeOut'}, function() {
				layout.fontSizeClass = 'font-size-' + fontSize;
				layout.zoomClass = 'zoom-' + settings.zoom;
				$rootScope.$apply();
				layout.binderSize.set(binderSize, {duration: 180, curve: 'custom'});
			});
			var previewSize = getPreviewSize();
			layout.previewTrans.set(getPreviewTrans(), {duration: 180, curve: 'easeOut'}, function() {
				layout.previewSize.set(previewSize, {duration: 180, curve: 'custom'});
			});
		}

		window.addEventListener('resize', window.ced.Utils.debounce(setTransition, 180));

		var onTogglePreview = window.ced.Utils.createHook(layout, 'onTogglePreview');
		layout.togglePreview = function(isOpen) {
			isOpen = isOpen === undefined ? !layout.isPreviewOpen : isOpen;
			if(isOpen != layout.isPreviewOpen) {
				layout.isPreviewOpen = isOpen;
				onTogglePreview(isOpen);
				setTransition();
			}
		};

		layout.applyZoom = setTransition;

		return layout;
	});
