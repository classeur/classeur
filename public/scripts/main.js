angular.module('stackedit.main', [
	'ngMaterial',
	'ngAnimate',
	'famous.angular'
])
	.config(function($animateProvider) {
		$animateProvider.classNameFilter(/angular-animate/);
	})
	.run(function($famous) {
		var TweenTransition = $famous['famous/transitions/TweenTransition'];
		TweenTransition.registerCurve('custom', function(t) {
			//return t*t*t*t;
			/*
			 */
			var p = 0.3;
			return Math.pow(2, -10 * t) * Math.sin((t - p / 4) * (2 * Math.PI) / p) + 1;
		});
	})
	.factory('cedSrv', function() {
		var converter = new window.Markdown.Converter();
		return {
			convert: function() {
				this.html = converter.makeHtml(this.editor.getContent());
			},
			refreshPreview: function() {
				this.previewElt.innerHTML = this.html;
			}
		};
	})
	.factory('layoutSrv', function($famous, $rootScope, settings) {
		var Transitionable = $famous['famous/transitions/Transitionable'];
		var layoutSrv = {};
		var previewSizeAdjust = 130;
		var pageWidth;
		function getBinderSize() {
			layoutSrv.fontSizeClass = '';
			var factor = 1 + (settings.zoom - 3) * 0.1;
			pageWidth = 960 * factor;
			if(document.body.clientWidth < 1120 * factor) {
				layoutSrv.fontSizeClass = 'font-size-2';
				pageWidth = 880 * factor;
			}
			if(document.body.clientWidth < 1040 * factor) {
				pageWidth = 800 * factor;
			}
			if(document.body.clientWidth - 50 < pageWidth) {
				layoutSrv.fontSizeClass = 'font-size-1';
				pageWidth = document.body.clientWidth - 50;
			}
			if(layoutSrv.isPreviewOpen && document.body.clientWidth/2 + 50 < pageWidth) {
				pageWidth = document.body.clientWidth/2 + 50;
			}
			return [pageWidth, undefined];
		}
		function getPreviewSize() {
			return [pageWidth - previewSizeAdjust, undefined];
		}
		function getBinderTrans() {
			return [
				(layoutSrv.isPreviewOpen ? -pageWidth/2 + 10: -20),
				0
			];
		}
		function getPreviewTrans() {
			return [
				layoutSrv.isPreviewOpen ? (pageWidth - previewSizeAdjust)/2 + 70: -20,
				0
			];
		}
		layoutSrv.pageMargin = 25;
		layoutSrv.binderSize = new Transitionable(getBinderSize());
		layoutSrv.binderTrans = new Transitionable(getBinderTrans());
		layoutSrv.previewSize = new Transitionable(getPreviewSize());
		layoutSrv.previewTrans = new Transitionable(getPreviewTrans());
		layoutSrv.zoomClass = 'zoom-' + settings.zoom;

		function setTransition() {
			var binderSize = getBinderSize();
			layoutSrv.binderTrans.set(getBinderTrans(), {duration: 180, curve: 'easeOut'}, function() {
				$rootScope.$apply();
				layoutSrv.binderSize.set(binderSize, {duration: 180, curve: 'custom'});
			});
			var previewSize = getPreviewSize();
			layoutSrv.previewTrans.set(getPreviewTrans(), {duration: 180, curve: 'easeOut'}, function() {
				layoutSrv.previewSize.set(previewSize, {duration: 180, curve: 'custom'});
			});
		}

		window.addEventListener('resize', window.ced.Utils.debounce(setTransition, 180));

		layoutSrv.togglePreview = function(isOpen) {
			isOpen = isOpen === undefined ? !layoutSrv.isPreviewOpen : isOpen;
			if(isOpen != layoutSrv.isPreviewOpen) {
				layoutSrv.isPreviewOpen = isOpen;
				setTransition();
			}
		};

		layoutSrv.applyZoom = function() {
			layoutSrv.zoomClass = 'zoom-' + settings.zoom;
			setTransition();
		};

		return layoutSrv;
	})
	.directive('ced', function(cedSrv) {
		return {
			link: function(scope, element) {
				window.rangy.init();
				cedSrv.editor = window.ced(element[0], {
					language: window.prismMd,
					sectionDelimiter: '^.+[ \\t]*\\n=+[ \\t]*\\n+|^.+[ \\t]*\\n-+[ \\t]*\\n+|^\\#{1,6}[ \\t]*.+?[ \\t]*\\#*\\n+'
				});

				var debouncedRefreshPreview = window.ced.Utils.debounce(function() {
					cedSrv.convert();
					cedSrv.refreshPreview();
				}, 500);
				cedSrv.editor.onContentChanged(function(content, sectionList) {
					console.log(sectionList)
					debouncedRefreshPreview();
				});
				cedSrv.editor.init();
				cedSrv.convert();
				if(cedSrv.previewElt) {
					cedSrv.refreshPreview();
				}
			}
		};
	})
	.directive('preview', function(cedSrv) {
		return {
			link: function(scope, element) {
				cedSrv.previewElt = element[0];
				if(cedSrv.content !== undefined) {
					cedSrv.refresh();
				}
			}
		};
	})
	.controller('BtnBarCtrl', function($scope, $famous, btnBarSrv, cedSrv) {
		var Transitionable = $famous['famous/transitions/Transitionable'];

		$scope.btnBarHeight = 70;
		$scope.btnBarVisibleHeight = 48;
		$scope.btnWidth = 30;
		$scope.btnHeight = 30;
		$scope.btnBarMargin = 40;
		$scope.btns = [
			{
				icon: 'mdi-editor-format-bold'
			},
			{
				icon: 'mdi-editor-format-italic'
			},
			{
				separator: true,
				icon: 'mdi-content-link'
			},
			{
				icon: 'mdi-editor-format-quote'
			},
			{
				icon: 'mdi-action-settings-ethernet'
			},
			{
				icon: 'mdi-image-crop-original'
			},
			{
				separator: true,
				icon: 'mdi-editor-format-list-numbered'
			},
			{
				icon: 'mdi-editor-format-list-bulleted'
			},
			{
				icon: 'mdi-editor-format-size'
			},
			{
				icon: 'mdi-navigation-more-horiz'
			},
			{
				separator: true,
				icon: 'mdi-content-undo',
				click: function() {
					cedSrv.editor.undoMgr.undo();
				}
			},
			{
				icon: 'mdi-content-redo',
				click: function() {
					cedSrv.editor.undoMgr.redo();
				}
			},

		];

		var offset = $scope.btnBarMargin;
		$scope.btns.forEach(function(btn) {
			if(btn.separator) {
				offset += 20;
			}
			btn.offset = offset;
			btn.scaleTrans = new Transitionable([
				0.9,
				0.9
			]);
			btn.opacityTrans = new Transitionable(0.8);
			btn.hover = function(enable) {
				this.scaleTrans.set([
					enable ? 1 : 0.9,
					enable ? 1 : 0.9
				], {duration: 180, curve: 'easeOut'});
				this.opacityTrans.set(enable ? 1 : 0.8, {duration: 180, curve: 'easeOut'});
			};
			offset += $scope.btnWidth;
		});
		$scope.btnBarWidth = offset + $scope.btnBarMargin;

		var openOffsetY = $scope.btnBarVisibleHeight - $scope.btnBarHeight,
			closedOffsetY = -$scope.btnBarHeight - 10;

		function getBtnBarTrans() {
			return [
				0,
				btnBarSrv.isOpen ? openOffsetY : closedOffsetY
			];
		}

		$scope.btnBarTrans = new Transitionable(getBtnBarTrans());
		btnBarSrv.toggle = function(isOpen) {
			isOpen = isOpen === undefined ? !btnBarSrv.isOpen : isOpen;
			if(isOpen != btnBarSrv.isOpen) {
				btnBarSrv.isOpen = isOpen;
				setTransition();
			}
		};
		$scope.btnBarSrv = btnBarSrv;
		function setTransition() {
			if(btnBarSrv.isOpen) {
				$scope.btnBarTrans.delay(250);
			}
			$scope.btnBarTrans.set(getBtnBarTrans(), {duration: 500, curve: 'custom'});
		}

		btnBarSrv.isOpen = true;
		setTransition();
	})
	.controller('LayoutCtrl', function($scope, $famous, settings, menuSrv, pageSrv, layoutSrv) {
		var Transitionable = $famous['famous/transitions/Transitionable'];
		$scope.previewBtn = {
			scaleTrans: new Transitionable([
				0.9,
				0.9
			]),
			opacityTrans: new Transitionable(0.3),
			hover: function(enable) {
				this.scaleTrans.set([
					enable ? 1 : 0.9,
					enable ? 1 : 0.9
				], {duration: 180, curve: 'easeOut'});
				this.opacityTrans.set(enable ? 0.35 : 0.3, {duration: 180, curve: 'easeOut'});
			}
		};

		$scope.settings = settings;
		$scope.$watch('settings.zoom', layoutSrv.applyZoom);

		$scope.pageSrv = pageSrv;
		$scope.menuSrv = menuSrv;
		$scope.layoutSrv = layoutSrv;
	})
	.factory('btnBarSrv', function() {
		return {};
	})
	.factory('settings', function() {
		return {
			zoom: 3
		};
	})
	.factory('pageSrv', function($famous) {
		var Transitionable = $famous['famous/transitions/Transitionable'];
		return {
			trans: new Transitionable([
				0,
				0
			]),
			outerTrans: new Transitionable([
				0,
				0
			]),
			rot: new Transitionable([
				0,
				0,
				0
			])
		};
	})
	.factory('menuSrv', function($famous, btnBarSrv, pageSrv) {
		var menuWidth = 320;
		var menuSrv = {};

		function setTransition() {
			pageSrv.trans.set([
				menuSrv.isOpen ? -menuWidth : 0,
				menuSrv.isOpen ? -80 : 0
			], {duration: 180, curve: 'easeOutBounce'});
			pageSrv.outerTrans.set([
				menuSrv.isOpen ? 10 : 0,
				0
			], {duration: 180, curve: 'easeOutBounce'});
			pageSrv.rot.set([
				0,
				0,
				menuSrv.isOpen ? -0.03 : 0
			], {duration: 180, curve: 'easeOutBounce'});
		}

		menuSrv.toggle = function(isOpen) {
			isOpen = isOpen === undefined ? !menuSrv.isOpen : isOpen;
			if(isOpen != menuSrv.isOpen) {
				menuSrv.isOpen = isOpen;
				btnBarSrv.toggle(!menuSrv.isOpen);
				setTransition();
			}
		};
		return menuSrv;
	});

