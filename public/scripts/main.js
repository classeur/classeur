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
			return Math.pow(2,-10*t) * Math.sin((t-p/4)*(2*Math.PI)/p) + 1;
		});
	})
	.directive('ced', function() {
		return {
			link: function(scope, element) {
				window.rangy.init();
				window.ced(element[0], {
					language: window.prismMd
				});
			}
		};
	})
	.controller('EditBtnBarCtrl', function($scope, $famous) {
		var Transitionable  = $famous['famous/transitions/Transitionable'];
		var Engine = $famous['famous/core/Engine'];
		var Timer = $famous['famous/utilities/Timer'];

		$scope.btnBarHeight = 70;
		$scope.btnBarVisibleHeight = 48;
		$scope.btnWidth = 32;
		$scope.btnHeight = 42;
		$scope.btnBarMargin = 40;
		$scope.btns = [
			{
				path: 'editor/svg/ic_format_bold_24px.svg',
				class: 'svg-ic_format_bold_24px',
				icon: 'mdi-editor-format-bold'
			},
			{
				path: 'editor/svg/ic_format_italic_24px.svg',
				class: 'svg-ic_format_italic_24px',
				icon: 'mdi-editor-format-italic'
			},
			{
				separator: true,
				path: 'content/svg/ic_link_24px.svg',
				class: 'svg-ic_link_24px',
				icon: 'mdi-content-link'
			},
			{
				path: 'editor/svg/ic_format_quote_24px.svg',
				class: 'svg-ic_format_quote_24px',
				icon: 'mdi-editor-format-quote'
			},
			{
				path: 'action/svg/ic_settings_ethernet_24px.svg',
				class: 'svg-ic_settings_ethernet_24px',
				icon: 'mdi-action-settings-ethernet'
			},
			{
				path: 'image/svg/ic_crop_original_24px.svg',
				class: 'svg-ic_crop_original_24px',
				icon: 'mdi-image-crop-original'
			},
			{
				separator: true,
				path: 'editor/svg/ic_format_list_numbered_24px.svg',
				class: 'svg-ic_format_list_numbered_24px',
				icon: 'mdi-editor-format-list-numbered'
			},
			{
				path: 'editor/svg/ic_format_list_bulleted_24px.svg',
				class: 'svg-ic_format_list_bulleted_24px',
				icon: 'mdi-editor-format-list-bulleted'
			},
			{
				path: 'editor/svg/ic_format_size_24px.svg',
				class: 'svg-ic_format_size_24px',
				icon: 'mdi-editor-format-size'
			},
			{
				path: 'navigation/svg/ic_more_horiz_24px.svg',
				class: 'svg-ic_more_horiz_24px',
				icon: 'mdi-navigation-more-horiz'
			},
			{
				separator: true,
				path: 'content/svg/ic_undo_24px.svg',
				class: 'svg-ic_undo_24px',
				icon: 'mdi-content-undo'
			},
			{
				path: 'content/svg/ic_redo_24px.svg',
				class: 'svg-ic_redo_24px',
				icon: 'mdi-content-redo'
			},

		];

		var offset = $scope.btnBarMargin;
		$scope.btns.forEach(function(btn) {
			if(btn.separator) {
				offset += 20;
			}
			btn.offset = offset;
			btn.scaleTrans = new Transitionable([0.9, 0.9]);
			btn.opacityTrans = new Transitionable(0.8);
			btn.hover = function(enable) {
				this.scaleTrans.set([enable ? 1 : 0.9, enable ? 1 : 0.9], {duration: 200, curve: 'easeOut'});
				this.opacityTrans.set(enable ? 1 : 0.8, {duration: 200, curve: 'easeOut'});
			};
			offset += $scope.btnWidth;
		});
		$scope.btnBarWidth = offset + $scope.btnBarMargin;

		var isOpen,
			openOffsetY = $scope.btnBarVisibleHeight - $scope.btnBarHeight,
			closedOffsetY = -$scope.btnBarHeight - 10;
		$scope.btnBarTrans = new Transitionable([0, closedOffsetY]);
		$scope.toggle = function() {
			isOpen = !isOpen;
			$scope.btnBarTrans.set([0, isOpen ? openOffsetY : closedOffsetY], {duration: 500, curve: 'custom'});
		};
		Timer.setTimeout($scope.toggle, 500);
	})
	.controller('PageLayoutCtrl', function($scope, $famous) {
		var Transitionable  = $famous['famous/transitions/Transitionable'];
		$scope.pageWidth = 960;
		$scope.pageMargin = 25;
		$scope.previewBtn = {
			scaleTrans: new Transitionable([0.9, 0.9]),
			opacityTrans: new Transitionable(0.2),
			hover: function(enable) {
				this.scaleTrans.set([enable ? 1 : 0.9, enable ? 1 : 0.9], {duration: 200, curve: 'easeOut'});
				this.opacityTrans.set(enable ? 0.25 : 0.2, {duration: 200, curve: 'easeOut'});
			}
		};
	});
