angular.module('classeur.extensions.btnBar', [])
	.directive('clBtnBarSettings', function() {
		return {
			restrict: 'E',
			templateUrl: 'extensions/btnBar/btnBarSettings.html'
		};
	})
	.directive('clBtnBar', function(clEditorSvc, clEditorLayoutSvc, clSettingSvc, clPanel) {
		clSettingSvc.setDefaultValue('btnBar', true);

		var btns = [
			{
				icon: 'mdi-editor-format-bold',
				label: 'Bold',
				keystroke: 'Ctrl/Cmd+B',
				click: function() {
					clEditorSvc.pagedownEditor.uiManager.doClick('bold');
				}
			},
			{
				icon: 'mdi-editor-format-italic',
				label: 'Italic',
				keystroke: 'Ctrl/Cmd+I',
				click: function() {
					clEditorSvc.pagedownEditor.uiManager.doClick('italic');
				}
			},
			{
				separator: true,
				icon: 'mdi-content-link',
				label: 'Link',
				keystroke: 'Ctrl/Cmd+L',
				click: function() {
					clEditorSvc.pagedownEditor.uiManager.doClick('link');
				}
			},
			{
				icon: 'mdi-editor-format-quote',
				label: 'Blockquote',
				keystroke: 'Ctrl/Cmd+Q',
				click: function() {
					clEditorSvc.pagedownEditor.uiManager.doClick('quote');
				}
			},
			{
				icon: 'mdi-action-settings-ethernet',
				label: 'Code',
				keystroke: 'Ctrl/Cmd+K',
				click: function() {
					clEditorSvc.pagedownEditor.uiManager.doClick('code');
				}
			},
			{
				icon: 'mdi-image-crop-original',
				label: 'Image',
				keystroke: 'Ctrl/Cmd+G',
				click: function() {
					clEditorSvc.pagedownEditor.uiManager.doClick('image');
				}
			},
			{
				separator: true,
				icon: 'mdi-editor-format-list-numbered',
				label: 'Numbered list',
				keystroke: 'Ctrl/Cmd+O',
				click: function() {
					clEditorSvc.pagedownEditor.uiManager.doClick('olist');
				}
			},
			{
				icon: 'mdi-editor-format-list-bulleted',
				label: 'Bullet list',
				keystroke: 'Ctrl/Cmd+U',
				click: function() {
					clEditorSvc.pagedownEditor.uiManager.doClick('ulist');
				}
			},
			{
				icon: 'mdi-editor-format-size',
				label: 'Heading',
				keystroke: 'Ctrl/Cmd+H',
				click: function() {
					clEditorSvc.pagedownEditor.uiManager.doClick('heading');
				}
			},
			{
				icon: 'mdi-navigation-more-horiz',
				label: 'Horizontal rule',
				keystroke: 'Ctrl/Cmd+R',
				click: function() {
					clEditorSvc.pagedownEditor.uiManager.doClick('hr');
				}
			},
			{
				separator: true,
				icon: 'mdi-content-undo',
				label: 'Undo',
				keystroke: 'Ctrl/Cmd+Z',
				click: function() {
					clEditorSvc.cledit.undoMgr.undo();
				}
			},
			{
				icon: 'mdi-content-redo',
				label: 'Redo',
				keystroke: 'Ctrl/Cmd+Y',
				click: function() {
					clEditorSvc.cledit.undoMgr.redo();
				}
			},

		];

		var props = {
			margin: 25,
			btnWidth: 30,
			btnHeight: 32,
			height: 70,
			visibleHeight: 48,
			paperHoleWidth: 260
		};

		var offset = props.margin;
		btns.forEach(function(btn) {
			if(btn.separator) {
				offset += 20;
			}
			btn.offset = offset;
			var click = btn.click;
			btn.click = function() {
				clEditorLayoutSvc.currentControl = undefined;
				setTimeout(click, 10);
			};
			offset += props.btnWidth;
		});
		props.width = offset + props.margin;

		return {
			restrict: 'E',
			templateUrl: 'extensions/btnBar/btnBar.html',
			scope: true,
			link: function(scope, element) {
				scope.btns = btns;
				scope.btnWidth = props.btnWidth;
				scope.btnHeight = props.btnHeight;
				scope.editor = clEditorSvc;

				var isOpen,
					openOffsetY = props.visibleHeight - props.height,
					closedOffsetY = -props.height - 10;

				var btnBarPanel = clPanel(element, '.btn-bar.panel').width(props.width).height(props.height).top(2000);
				btnBarPanel.move().to(-props.width / 2, closedOffsetY).end();
				clPanel(element, '.hole.panel').width(props.paperHoleWidth).move().x(-props.paperHoleWidth / 2).end();

				scope.$watch('editorLayoutSvc.pageWidth', animate);
				scope.$watch('editorLayoutSvc.isEditorOpen', animate);
				scope.$watch('editorLayoutSvc.isMenuOpen', animate);

				function animate() {
					var newIsOpen = !!clEditorLayoutSvc.isEditorOpen && !clEditorLayoutSvc.isMenuOpen && clEditorLayoutSvc.pageWidth - 240 > props.width;
					if(isOpen === newIsOpen) {
						return;
					}
					isOpen = newIsOpen;
					btnBarPanel.move('slow').delay(isOpen ? 250 : 0).to(-props.width / 2, isOpen ? openOffsetY : closedOffsetY).ease('ease-out-back').end();
				}
			}
		};
	});
