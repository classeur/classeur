angular.module('classeur.opt.btnBar', [])
	.directive('clBtnBarSettings', function() {
		return {
			restrict: 'E',
			templateUrl: 'opt/btnBar/btnBarSettings.html'
		};
	})
	.directive('clBtnBar', function(clEditorSvc, clEditorLayoutSvc, clPanel) {
		var btns = [{
			icon: 'icon-format-bold',
			label: 'Bold',
			keystroke: 'Ctrl/Cmd+B',
			click: function() {
				clEditorSvc.pagedownEditor.uiManager.doClick('bold');
			}
		}, {
			icon: 'icon-format-ital',
			label: 'Italic',
			keystroke: 'Ctrl/Cmd+I',
			click: function() {
				clEditorSvc.pagedownEditor.uiManager.doClick('italic');
			}
		}, {
			separator: true,
			icon: 'icon-link',
			label: 'Link',
			keystroke: 'Ctrl/Cmd+L',
			click: function() {
				clEditorSvc.pagedownEditor.uiManager.doClick('link');
			}
		}, {
			icon: 'icon-format-quote',
			label: 'Blockquote',
			keystroke: 'Ctrl/Cmd+Q',
			click: function() {
				clEditorSvc.pagedownEditor.uiManager.doClick('quote');
			}
		}, {
			icon: 'icon-code',
			label: 'Code',
			keystroke: 'Ctrl/Cmd+K',
			click: function() {
				clEditorSvc.pagedownEditor.uiManager.doClick('code');
			}
		}, {
			icon: 'icon-crop-original',
			label: 'Image',
			keystroke: 'Ctrl/Cmd+G',
			click: function() {
				clEditorSvc.pagedownEditor.uiManager.doClick('image');
			}
		}, {
			separator: true,
			icon: 'icon-format-list-numbered',
			label: 'Numbered list',
			keystroke: 'Ctrl/Cmd+O',
			click: function() {
				clEditorSvc.pagedownEditor.uiManager.doClick('olist');
			}
		}, {
			icon: 'icon-format-list-bulleted',
			label: 'Bullet list',
			keystroke: 'Ctrl/Cmd+U',
			click: function() {
				clEditorSvc.pagedownEditor.uiManager.doClick('ulist');
			}
		}, {
			icon: 'icon-format-size',
			label: 'Heading',
			keystroke: 'Ctrl/Cmd+H',
			click: function() {
				clEditorSvc.pagedownEditor.uiManager.doClick('heading');
			}
		}, {
			icon: 'icon-hr',
			label: 'Horizontal rule',
			keystroke: 'Ctrl/Cmd+R',
			click: function() {
				clEditorSvc.pagedownEditor.uiManager.doClick('hr');
			}
		}];

		var undoButton = {
			separator: true,
			icon: 'icon-undo',
			label: 'Undo',
			keystroke: 'Ctrl/Cmd+Z',
			click: function() {
				clEditorSvc.cledit.undoMgr.undo();
			}
		};

		var redoButton = {
			icon: 'icon-redo',
			label: 'Redo',
			keystroke: 'Ctrl/Cmd+Y',
			click: function() {
				clEditorSvc.cledit.undoMgr.redo();
			}
		};

		btns.push(undoButton);
		btns.push(redoButton);

		var props = {
			margin: 25,
			btnWidth: 30,
			btnHeight: 32,
			height: 60,
			visibleHeight: 46,
			paperHoleWidth: 260
		};

		var offset = props.margin;
		btns.forEach(function(btn) {
			if (btn.separator) {
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
			templateUrl: 'opt/btnBar/btnBar.html',
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
				//clPanel(element, '.hole.panel').width(props.paperHoleWidth).move().x(-props.paperHoleWidth / 2).end();

				scope.$watch('editorLayoutSvc.pageWidth', animate);
				scope.$watch('editorLayoutSvc.isEditorOpen', animate);
				scope.$watch('editorLayoutSvc.isMenuOpen', animate);

				function checkBtnActive() {
					undoButton.isActive = !clEditorSvc.cledit.undoMgr.canUndo();
					redoButton.isActive = !clEditorSvc.cledit.undoMgr.canRedo();
					scope.$evalAsync();
				}

				checkBtnActive();
				clEditorSvc.cledit.undoMgr.on('undoStateChange', checkBtnActive);
				scope.$on('$destroy', function() {
					clEditorSvc.cledit.undoMgr.off('undoStateChange', checkBtnActive);
				});

				function animate() {
					var newIsOpen = !!clEditorLayoutSvc.isEditorOpen && !clEditorLayoutSvc.isMenuOpen && clEditorLayoutSvc.pageWidth - 240 > props.width;
					if (isOpen === newIsOpen) {
						return;
					}
					isOpen = newIsOpen;
					btnBarPanel.move('slow').delay(isOpen ? 270 : 0).to(-props.width / 2, isOpen ? openOffsetY : closedOffsetY).ease('ease-out-back').end();
				}
			}
		};
	});
