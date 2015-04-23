angular.module('classeur.blogs', [])
	.filter('clBlogStatus', function() {
		return function(status) {
			return status || 'not linked';
		};
	})
	.directive('clBlogEntry', function(clBlogSvc) {
		return {
			restrict: 'E',
			templateUrl: 'blogs/blogEntry.html',
			link: function(scope) {
				scope.platform = clBlogSvc.platformMap[scope.blog.platform];
			}
		};
	})
	.directive('clBlogForm', function(clBlogSvc) {
		return {
			restrict: 'E',
			templateUrl: 'blogs/blogForm.html',
			link: function(scope) {
				scope.platforms = clBlogSvc.platformMap;
			}
		};
	})
	.factory('clBlogPlatform', function() {
		function BlogPlatform(id, name, icon) {
			this.id = id;
			this.name = name;
			this.icon = icon;
		}
		var result = function(id, name, icon) {
			return new BlogPlatform(id, name, icon);
		};
		result.BlogPlatform = BlogPlatform;
		return result;
	})
	.factory('clBlogSvc', function(clGithubBlogPlatform, $window, clToast, clBlogPlatform) {
		var platformMap = Array.prototype.reduce.call(arguments, function(platformMap, arg) {
			if (arg instanceof clBlogPlatform.BlogPlatform) {
				platformMap[arg.id] = arg;
			}
			return platformMap;
		}, {});

		return {
			platformMap: platformMap,
			createForm: function(blog) {
				var form = angular.extend({}, blog);
				if (blog) {
					form = platformMap[blog.platform].createForm(form);
					form.name = blog.name;
					form.platform = blog.platform;
				}
				return form;
			},
			createBlog: function(form) {
				var platform = platformMap[form.platform];
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
					var blog = platform.validateForm(form);
					blog.name = form.name;
					blog.platform = form.platform;
					return blog;
				} catch (e) {
					clToast(e);
				}
			},
			startOAuth: function(blog, state) {
				var platform = platformMap[blog.platform];
				var params = platform.getOauthUrlParams(blog);
				var url = params.url;
				delete params.url;
				params.state = state;
				$window.location.href = url + '?' + Object.keys(params).map(function(key) {
					return key + '=' + encodeURIComponent(params[key]);
				}).join('&');
			}
		};

	});
