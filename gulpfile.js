var gulp = require('gulp');
var watch = require('gulp-watch');
var concat = require('gulp-concat');
var sourcemaps = require('gulp-sourcemaps');
var sass = require('gulp-sass');
var inject = require('gulp-inject');
var templateCache = require('gulp-angular-templatecache');

gulp.task('express', function() {
	process.env.NO_CLUSTER = true;
	require('./index');
});

gulp.task('sass', function() {
	return gulp.src(__dirname + '/public/styles/main.scss')
		.pipe(sass())
		//.pipe(minifycss())
		.pipe(gulp.dest(__dirname + '/public/styles'));
});


var vendorJs = [
	'public/bower_components/angular/angular.js',
	'public/bower_components/angular-animate/angular-animate.js',
	'public/bower_components/angular-aria/angular-aria.js',
	'public/bower_components/angular-route/angular-route.js',
	'public/bower_components/movejs/move.js',
	'public/bower_components/hammerjs/hammer.js',
	'public/bower_components/angular-material/angular-material.js',
	'public/bower_components/angular-slugify/angular-slugify.js',
	'public/bower_components/google-diff-match-patch-js/diff_match_patch.js',
	'public/bower_components/rangy-official/rangy-core.js',
	'public/bower_components/rangy-official/rangy-classapplier.js',
	'public/bower_components/cledit/scripts/cleditCore.js',
	'public/bower_components/cledit/scripts/cleditHighlighter.js',
	'public/bower_components/cledit/scripts/cleditKeystroke.js',
	'public/bower_components/cledit/scripts/cleditMarker.js',
	'public/bower_components/cledit/scripts/cleditPrism.js',
	'public/bower_components/cledit/scripts/cleditSelectionMgr.js',
	'public/bower_components/cledit/scripts/cleditUndoMgr.js',
	'public/bower_components/cledit/scripts/cleditUtils.js',
	'public/bower_components/cledit/scripts/cleditWatcher.js',
	'public/bower_components/cledit/examples/markdownEditor/mdGrammar.js',
	'public/bower_components/highlightjs/highlight.pack.js',
	'public/bower_components/google-code-prettify/src/prettify.js',
	'public/components/Markdown.Converter.js',
	'public/components/Markdown.Editor.js',
	'public/bower_components/pagedown-extra/Markdown.Extra.js',
];

gulp.task('template-cache', function() {
	return gulp.src(['public/app/**/*.html', 'public/app/**/*.md'])
		.pipe(templateCache({
			module: 'classeur.templates',
			root: 'app/',
			standalone: true
		}))
		.pipe(gulp.dest('public/app'));
});

gulp.task('js-dev', ['template-cache'], function() {
	gulp.src(vendorJs.concat('public/app/**/*.js'))
		.pipe(sourcemaps.init())
		.pipe(concat('app-min.js', {newLine: ';'}))
		.pipe(sourcemaps.write('.'))
		.pipe(gulp.dest('public'));
});

gulp.task('watch', function() {
	watch(['/public/styles/*.scss', '/public/app/**/*.scss'], function(files, cb) {
		gulp.start('sass');
		cb();
	});
	watch(['/public/app/**/*.js', 'public/app/**/*.html', 'public/app/**/*.md'], function(files, cb) {
		gulp.start('js-dev');
		cb();
	});
});

gulp.task('run', [
	'sass',
	'js-dev',
	'watch',
	'express'
]);

gulp.task('default', [
	'sass',
	'js-dev'
]);
