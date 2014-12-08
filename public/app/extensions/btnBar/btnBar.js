angular.module('classeur.extensions.btnBar', [])
	.directive('clBtnBarSettings', function() {
		return {
			restrict: 'E',
			templateUrl: 'app/extensions/btnBar/btnBarSettings.html'
		};
	})
	.directive('clBtnBar', function($famous, cledit, layout, settings) {
		settings.setDefaultValue('btnBar', true);

		var btns = [
			{
				icon: 'mdi-editor-format-bold',
				label: 'Bold',
				click: function() {
					cledit.pagedownEditor.uiManager.doClick('bold');
				}
			},
			{
				icon: 'mdi-editor-format-italic',
				label: 'Italic',
				click: function() {
					cledit.pagedownEditor.uiManager.doClick('italic');
				}
			},
			{
				separator: true,
				icon: 'mdi-content-link',
				label: 'Link',
				click: function() {
					cledit.pagedownEditor.uiManager.doClick('link');
				}
			},
			{
				icon: 'mdi-editor-format-quote',
				label: 'Blockquote',
				click: function() {
					cledit.pagedownEditor.uiManager.doClick('quote');
				}
			},
			{
				icon: 'mdi-action-settings-ethernet',
				label: 'Code',
				click: function() {
					cledit.pagedownEditor.uiManager.doClick('code');
				}
			},
			{
				icon: 'mdi-image-crop-original',
				label: 'Image',
				click: function() {
					cledit.pagedownEditor.uiManager.doClick('image');
				}
			},
			{
				separator: true,
				icon: 'mdi-editor-format-list-numbered',
				label: 'List',
				click: function() {
					cledit.pagedownEditor.uiManager.doClick('olist');
				}
			},
			{
				icon: 'mdi-editor-format-list-bulleted',
				label: 'Numbered list',
				click: function() {
					cledit.pagedownEditor.uiManager.doClick('ulist');
				}
			},
			{
				icon: 'mdi-editor-format-size',
				label: 'Heading',
				click: function() {
					cledit.pagedownEditor.uiManager.doClick('heading');
				}
			},
			{
				icon: 'mdi-navigation-more-horiz',
				label: 'Horizontal rule',
				click: function() {
					cledit.pagedownEditor.uiManager.doClick('hr');
				}
			},
			{
				separator: true,
				icon: 'mdi-content-undo',
				label: 'Undo',
				click: function() {
					cledit.editor.undoMgr.undo();
				}
			},
			{
				icon: 'mdi-content-redo',
				label: 'Redo',
				click: function() {
					cledit.editor.undoMgr.redo();
				}
			},

		];

		var props = {
			margin: 30,
			btnWidth: 30,
			btnHeight: 30,
			height: 70,
			visibleHeight: 48
		};

		var offset = props.margin;
		btns.forEach(function(btn) {
			if(btn.separator) {
				offset += 20;
			}
			btn.offset = offset;
			offset += props.btnWidth;
		});
		props.width = offset + props.margin;

		return {
			restrict: 'E',
			templateUrl: 'app/extensions/btnBar/btnBar.html',
			scope: true,
			link: function(scope) {
				var Transitionable = $famous['famous/transitions/Transitionable'];

				angular.extend(scope, props);
				scope.btns = btns;

				var openOffsetY = scope.visibleHeight - scope.height,
					closedOffsetY = -scope.height - 10;

				scope.$watch('layout.pageWidth', setTransition);
				scope.$watch('layout.isEditorOpen', setTransition);
				scope.$watch('layout.isMenuOpen', setTransition);

				var isOpen;
				function getTrans() {
					return [
						0,
						isOpen ? openOffsetY : closedOffsetY
					];
				}

				scope.trans = new Transitionable(getTrans());
				function setTransition() {
					var newIsOpen = settings.values.btnBar && !!layout.isEditorOpen && !layout.isMenuOpen && layout.pageWidth - 150 > scope.width;
					if(isOpen === newIsOpen) {
						return;
					}
					isOpen = newIsOpen;
					if(isOpen) {
						scope.trans.delay(250);
					}
					scope.trans.set(getTrans(), {duration: 120, curve: 'easeOutBounce'});
				}
			}
		};
	});
