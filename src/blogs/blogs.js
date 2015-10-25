angular.module('classeur.blogs', [])
	.filter('clBlogStatus',
		function() {
			return function(status) {
				return status || 'not linked';
			};
		})
	.directive('clBlogEntry',
		function(clBlogSvc) {
			return {
				restrict: 'E',
				templateUrl: 'blogs/blogEntry.html',
				link: link
			};

			function link(scope) {
				scope.platform = clBlogSvc.platformMap[scope.blog.platformId];
			}
		})
	.directive('clBlogPostEntry',
		function() {
			return {
				restrict: 'E',
				templateUrl: 'blogs/blogPostEntry.html'
			};
		})
	.directive('clBlogForm',
		function(clBlogSvc) {
			return {
				restrict: 'E',
				templateUrl: 'blogs/blogForm.html',
				link: link
			};

			function link(scope) {
				scope.platforms = clBlogSvc.platformMap;
				scope.$watch('form.platformId', function(platformId) {
					scope.form.subForm = scope.blog ?
						({}).cl_extend(scope.blog) :
						clBlogSvc.createBlogSubForm(platformId);
					clBlogSvc.fillBlogSubForm(platformId, scope.form.subForm);
				});
			}
		})
	.directive('clBlogPostForm',
		function($window, $q, clBlogSvc, clSocketSvc, clSettingSvc) {
			return {
				restrict: 'E',
				templateUrl: 'blogs/blogPostForm.html',
				link: link
			};

			function link(scope) {
				scope.form.templateKey = 'Plain HTML';
				scope.templates = clSettingSvc.values.exportTemplates;
				scope.$watch('form.templateKey', function(templateKey) {
					if (templateKey) {
						scope.form.template = scope.templates[templateKey];
					}
				});

				var blogMap = Object.create(null);
				if (!scope.post) {
					var loading = $q(function(resolve) {
						var unwatch = scope.$watch('socketSvc.isReady', function() {
							clSocketSvc.sendMsg({
								type: 'getBlogs'
							});
						});

						function blogsHandler(msg) {
							clSocketSvc.removeMsgHandler('blogs', blogsHandler);
							blogMap = msg.blogs.cl_reduce(function(blogMap, blog) {
								blog.platform = clBlogSvc.platformMap[blog.platformId];
								return (blogMap[blog.id] = blog, blogMap);
							}, {});
							scope.blogs = msg.blogs;
							unwatch();
							resolve();
						}
						clSocketSvc.addMsgHandler('blogs', blogsHandler);
						scope.$on('$destroy', function() {
							clSocketSvc.removeMsgHandler('blogs', blogsHandler);
							unwatch();
							resolve();
						});
					});

					scope.loadBlogs = function() {
						return loading;
					};
				}

				scope.$watch('form.blogId', function(blogId) {
					var blog = blogMap[blogId];
					scope.form.blog = blog;
					scope.form.subForm = scope.post ?
						({}).cl_extend(scope.post) :
						clBlogSvc.createPostSubForm(blog);
					clBlogSvc.fillPostSubForm(blog, scope.form.subForm);
				});
			}
		})
	.factory('clBlogPlatform',
		function() {
			function BlogPlatform(options) {
				this.cl_extend(options);
			}
			var result = function(options) {
				return new BlogPlatform(options);
			};
			result.BlogPlatform = BlogPlatform;
			return result;
		})
	.factory('clBlogSvc',
		function(clBloggerBlogPlatform, clGithubBlogPlatform, clWordpressBlogPlatform, $window, clToast, clBlogPlatform) {
			var platformMap = Array.prototype.cl_reduce.call(arguments, function(platformMap, arg) {
				if (arg instanceof clBlogPlatform.BlogPlatform) {
					platformMap[arg.id] = arg;
				}
				return platformMap;
			}, Object.create(null));

			return {
				platformMap: platformMap,
				createBlogSubForm: function(platformId) {
					return ({}).cl_extend(platformId && platformMap[platformId].defaultBlogSubForm);
				},
				fillBlogSubForm: function(platformId, subForm) {
					platformId && platformMap[platformId].fillBlogSubForm && platformMap[platformId].fillBlogSubForm(subForm);
				},
				createBlog: function(form) {
					var platform = platformMap[form.platformId];
					try {
						if (!platform) {
							throw 'Please select a platform.';
						}
						if (!form.name) {
							throw 'Blog name is required.';
						}
						if (form.name.length > 128) {
							throw 'Blog name is too long.';
						}
						var blog = platform.createBlogFromSubForm(form.subForm);
						blog.name = form.name;
						blog.platformId = form.platformId;
						return blog;
					} catch (e) {
						clToast(e);
					}
				},
				createPostSubForm: function(blog) {
					return blog ?
						({}).cl_extend(blog).cl_extend(platformMap[blog.platformId].defaultPostSubForm) : {};
				},
				fillPostSubForm: function(blog, subForm) {
					blog && platformMap[blog.platformId].fillPostSubForm && platformMap[blog.platformId].fillPostSubForm(blog, subForm);
				},
				createPost: function(form) {
					var blog = form.blog;
					try {
						if (!blog) {
							throw 'Please select a blog.';
						}
						var post = blog.platform.createPostFromSubForm(form.subForm);
						post.blogId = blog.id;
						post.template = form.template || '';
						return post;
					} catch (e) {
						clToast(e);
					}
				},
				startOAuth: function(blog, state) {
					var platform = platformMap[blog.platformId];
					var params = platform.getAuthorizeParams(blog);
					params.state = state;
					$window.location.href = platform.authorizeUrl + '?' + params.cl_map(function(value, key) {
						return key + '=' + encodeURIComponent(value);
					}).join('&');
				}
			};
		});
