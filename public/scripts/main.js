angular.module('classeur.main', [
	'ngMaterial',
	'ngAnimate',
	'famous.angular',
	'classeur.services.cleditor',
	'classeur.services.layout',
	'classeur.services.settings',
	'classeur.services.scrollSync',
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
	.directive('ced', function(cleditor, scrollSync) {
		return {
			link: function(scope, element) {
				window.rangy.init();
				cleditor.editorElt = element[0];
				cleditor.editor = window.ced(cleditor.editorElt, {
					language: window.prismMd,
					sectionDelimiter: '^.+[ \\t]*\\n=+[ \\t]*\\n+|^.+[ \\t]*\\n-+[ \\t]*\\n+|^\\#{1,6}[ \\t]*.+?[ \\t]*\\#*\\n+'
				});
				scrollSync.setEditorElt(cleditor.editorElt);

				var debouncedRefreshPreview = window.ced.Utils.debounce(function() {
					cleditor.convert();
					cleditor.refreshPreview();
				}, 500);
				cleditor.editor.onContentChanged(function(content, sectionList) {
					cleditor.sectionList = sectionList;
					debouncedRefreshPreview();
				});
				cleditor.editor.init();
				cleditor.convert();
				if(cleditor.previewElt) {
					cleditor.refreshPreview();
				}
			}
		};
	})
	.directive('preview', function(cleditor, scrollSync) {
		return {
			link: function(scope, element) {
				cleditor.previewElt = element[0];
				scrollSync.setPreviewElt(cleditor.previewElt);
				if(cleditor.content !== undefined) {
					cleditor.refresh();
				}
			}
		};
	})
	.controller('BtnBarCtrl', function($scope, $famous, btnBarSrv, cleditor) {
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
					cleditor.editor.undoMgr.undo();
				}
			},
			{
				icon: 'mdi-content-redo',
				click: function() {
					cleditor.editor.undoMgr.redo();
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
			$scope.btnBarTrans.set(getBtnBarTrans(), {duration: 120, curve: 'easeOutBounce'});
		}

		btnBarSrv.isOpen = true;
		setTransition();
	})
	.controller('LayoutCtrl', function($scope, $famous, settings, menuSrv, pageSrv, layout) {
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
		$scope.$watch('settings.zoom', layout.applyZoom);

		$scope.pageSrv = pageSrv;
		$scope.menuSrv = menuSrv;
		$scope.layout = layout;
	})
	.factory('btnBarSrv', function() {
		return {};
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
				menuSrv.isOpen ? -60 : 0
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

