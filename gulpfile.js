var path = require('path');
var clgulp = require('clgulp');
var gulp = clgulp(require('gulp'));
var exec = clgulp.exec;
var util = clgulp.util;
var watch = require('gulp-watch');
var concat = require('gulp-concat');
var ngAnnotate = require('gulp-ng-annotate');
var uglify = require('gulp-uglify');
var sourcemaps = require('gulp-sourcemaps');
var streamqueue = require('streamqueue');
var replace = require('gulp-replace');
var sass = require('gulp-sass');
var templateCache = require('gulp-angular-templatecache');
var size = require('gulp-size');

var isDebug = false;

gulp.task('tag', function(cb) {
	var version = require('./package').version;
	var tag = 'v' + version;
	util.log('Tagging as: ' + util.colors.cyan(tag));
	exec([
		'git add package.json',
		'git commit -m "Prepare release"',
		'git tag -a ' + tag + ' -m "Version ' + version + '"',
		'git push origin master --tags',
		'npm publish',
	], cb);
});

gulp.task('start', [
	'watch',
	'connect'
]);

gulp.task('default', [
	'app-css',
	'base-css',
	'app-js',
	'template-worker-js'
]);

var appVendorJs = [
	'angular/angular',
	'angular-animate/angular-animate',
	'angular-aria/angular-aria',
	'angular-google-analytics/dist/angular-google-analytics',
	'angular-messages/angular-messages',
	'angular-route/angular-route',
	'angular-material/angular-material',
	'bezier-easing/build',
	'clanim/clanim',
	'googlediff/javascript/diff_match_patch_uncompressed', // Needs to come before cldiffutils and cledit
	'clunderscore/clunderscore', // Needs to come before cledit
	'cldiffutils/cldiffutils',
	'cldiffutils/cldiffutils',
	'cledit/scripts/cleditCore',
	'cledit/scripts/cleditHighlighter',
	'cledit/scripts/cleditKeystroke',
	'cledit/scripts/cleditMarker',
	'cledit/scripts/cleditSelectionMgr',
	'cledit/scripts/cleditUndoMgr',
	'cledit/scripts/cleditUtils',
	'cledit/scripts/cleditWatcher',
	'cledit/demo/mdGrammar',
	'filesaver.js/FileSaver',
	'hammerjs/hammer',
	'markdown-it/dist/markdown-it',
	'markdown-it-abbr/dist/markdown-it-abbr',
	'markdown-it-deflist/dist/markdown-it-deflist',
	'markdown-it-emoji/dist/markdown-it-emoji',
	'markdown-it-footnote/dist/markdown-it-footnote',
	'markdown-it-sub/dist/markdown-it-sub',
	'markdown-it-sup/dist/markdown-it-sup',
	'prismjs/components/prism-core',
	'prismjs/components/prism-markup',
	'prismjs/components/prism-clike',
	'prismjs/components/prism-javascript',
	'prismjs/components/prism-css',
].map(require.resolve);
appVendorJs.push(path.join(path.dirname(require.resolve('prismjs/components/prism-core')), 'prism-!(*.min).js'));

var templateCacheSrc = ['src/**/*.{html,md,json}'];
var appJsSrc = ['src/app.js', 'src/!(workers)/**/*.js'];

gulp.task('app-js', function() {
	return buildJs(streamqueue({
			objectMode: true
		},
		gulp.src(appVendorJs),
		gulp.src(appJsSrc),
		gulp.src(templateCacheSrc)
		.pipe(templateCache({
			module: 'classeur.templates',
			standalone: true
		}))
	), 'app-min.js');
});

var templateWorkerVendorJs = [
	'handlebars/dist/handlebars',
].map(require.resolve);

var templateWorkerJsSrc = ['src/workers/templateWorker.js'];

gulp.task('template-worker-js', function() {
	return buildJs(streamqueue({
			objectMode: true
		},
		gulp.src(templateWorkerVendorJs),
		gulp.src(templateWorkerJsSrc)
	), 'templateWorker-min.js');
});

var appCssSrc = ['src/**/!(base).scss'];

var appVendorCss = [
	path.join(path.dirname(require.resolve('angular-material')), 'angular-material.css'),
	path.join(path.dirname(require.resolve('classets/package')), 'public/icons/style.css')
];

gulp.task('app-css', function() {
	return buildCss(streamqueue({
			objectMode: true
		},
		gulp.src(appVendorCss).pipe(replace(/@import\s.*/g, '')),
		gulp.src(appCssSrc)
	), 'app-min.css');
});

gulp.task('base-css', function() {
	return buildCss(streamqueue({
			objectMode: true
		},
		gulp.src('src/styles/base.scss')
	), 'base-min.css');
});

gulp.task('connect', function() {
	process.env.NO_CLUSTER = true;
	require('./');
});

gulp.task('watch', [
	'debug',
	'default'
], function() {
	function watchAndStart(src, task) {
		return watch(src, function(files, cb) {
			gulp.start(task);
			cb();
		});
	}
	watchAndStart(['src/**/*.scss'], 'app-css');
	watchAndStart(templateCacheSrc.concat(appJsSrc), 'app-js');
	watchAndStart(templateWorkerJsSrc, 'template-worker-js');
});

gulp.task('debug', function() {
	isDebug = true;
});

function buildJs(srcStream, dest) {
	if (isDebug) {
		srcStream = srcStream
			.pipe(sourcemaps.init())
			.pipe(concat(dest, {
				newLine: ';'
			}))
			.pipe(sourcemaps.write('.'));
	} else {
		srcStream = srcStream
			.pipe(size({
				//showFiles: true
			}))
			.pipe(ngAnnotate())
			.pipe(uglify())
			.pipe(concat(dest, {
				newLine: ';'
			}));
	}
	return srcStream.pipe(gulp.dest('public'));
}

function buildCss(srcStream, dest) {
	if (isDebug) {
		srcStream = srcStream
			.pipe(sourcemaps.init())
			.pipe(sass({
				includePaths: 'src/styles'
			}).on('error', sass.logError))
			.pipe(concat(dest))
			.pipe(sourcemaps.write('.'));
	} else {
		srcStream = srcStream
			.pipe(sass({
				includePaths: 'src/styles',
				outputStyle: 'compressed'
			}).on('error', sass.logError))
			.pipe(concat(dest));
	}
	return srcStream.pipe(gulp.dest('public'));
}
