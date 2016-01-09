var fs = require('fs')
var path = require('path')
var clgulp = require('clgulp')
var gulp = clgulp(require('gulp'))
var exec = clgulp.exec
var util = clgulp.util
var through2 = require('through2')
var watch = require('gulp-watch')
var concat = require('gulp-concat')
var ngAnnotate = require('gulp-ng-annotate')
var uglify = require('gulp-uglify')
var sourcemaps = require('gulp-sourcemaps')
var streamqueue = require('streamqueue')
var replace = require('gulp-replace')
var sass = require('gulp-sass')
var scsslint = require('gulp-scss-lint')
var templateCache = require('gulp-angular-templatecache')
var size = require('gulp-size')
var bourbon = require('bourbon')
var Comb = require('csscomb')
var beautifyHtml = require('js-beautify').html
var stripJsonComments = require('strip-json-comments')
var htmlhint = require('gulp-htmlhint')

var isDebug = false

gulp.task('tag', ['lint-all'], function (cb) {
  var version = require('./package').version
  var tag = 'v' + version
  util.log('Tagging as: ' + util.colors.cyan(tag))
  exec([
    'git add package.json',
    'git commit -m "Prepare release"',
    'git tag -a ' + tag + ' -m "Version ' + version + '"',
    'git push origin master --tags',
    'npm publish'
  ], cb)
})

gulp.task('start', [
  'watch',
  'connect'
])

gulp.task('default', [
  'app-css',
  'base-css',
  'app-js',
  'template-worker-js'
])

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
  'engine.io-client/engine.io',
  'filesaver.js/FileSaver',
  'hammerjs/hammer',
  'markdown-it/dist/markdown-it',
  'markdown-it-abbr/dist/markdown-it-abbr',
  'markdown-it-deflist/dist/markdown-it-deflist',
  'markdown-it-emoji/dist/markdown-it-emoji',
  'markdown-it-footnote/dist/markdown-it-footnote',
  'markdown-it-mathjax/markdown-it-mathjax',
  'markdown-it-pandoc-renderer/markdown-it-pandoc-renderer',
  'markdown-it-sub/dist/markdown-it-sub',
  'markdown-it-sup/dist/markdown-it-sup',
  'prismjs/components/prism-core',
  'prismjs/components/prism-markup',
  'prismjs/components/prism-clike',
  'prismjs/components/prism-javascript',
  'prismjs/components/prism-css'
].map(require.resolve)
appVendorJs.push(path.join(path.dirname(require.resolve('prismjs/components/prism-core')), 'prism-!(*.min).js'))

var templateCacheSrc = ['src/**/*.{html,md,json}']
var appJsSrc = ['src/app.js', 'src/!(workers)/**/*.js']

gulp.task('app-js', function () {
  return buildJs(
    streamqueue({
      objectMode: true
    },
      gulp.src(appVendorJs),
      gulp.src(appJsSrc),
      gulp.src(templateCacheSrc)
        .pipe(templateCache({
          module: 'classeur.templates',
          standalone: true
        }))
    ), 'app-min.js')
})

var templateWorkerVendorJs = [
  'handlebars/dist/handlebars'
].map(require.resolve)

var templateWorkerJsSrc = ['src/workers/templateWorker.js']

gulp.task('template-worker-js', function () {
  return buildJs(
    streamqueue({
      objectMode: true
    },
      gulp.src(templateWorkerVendorJs),
      gulp.src(templateWorkerJsSrc)
    ), 'templateWorker-min.js')
})

var appCssSrc = ['src/**/!(base).scss']

var appVendorCss = [
  path.join(path.dirname(require.resolve('angular-material')), 'angular-material.css'),
  path.join(path.dirname(require.resolve('classets/package')), 'public/icons/style.css')
]

gulp.task('app-css', function () {
  return buildCss(
    streamqueue({
      objectMode: true
    },
      gulp.src(appVendorCss).pipe(replace(/@import\s.*/g, '')),
      gulp.src(appCssSrc)
    ), 'app-min.css')
})

gulp.task('base-css', function () {
  return buildCss(
    streamqueue({
      objectMode: true
    },
      gulp.src('src/styles/base.scss')
    ), 'base-min.css')
})

gulp.task('lint-all', [
  'lint',
  'lint-scss',
  'lint-scss-format',
  'lint-html',
  'lint-html-format'
])

gulp.task('lint-scss', function () {
  return gulp.src(appCssSrc)
    .pipe(scsslint())
    .pipe(scsslint.failReporter())
})

function csscombFormatter () {
  var comb = new Comb()
  comb.configure(require('./.csscomb.json'))
  return function (content) {
    return comb.processString(content, {
      syntax: 'scss'
    })
  }
}

gulp.task('lint-scss-format', function () {
  return gulp.src(appCssSrc)
    .pipe(checkFormat('csscomb-lint', csscombFormatter()))
})

gulp.task('format-scss', function () {
  return gulp.src(appCssSrc)
    .pipe(format('csscomb', csscombFormatter()))
    .pipe(gulp.dest('src'))
})

var htmlSrc = ['src/**/*.html', 'public/**/*.html']

gulp.task('lint-html', function () {
  return gulp.src(htmlSrc)
    .pipe(htmlhint('.htmlhintrc'))
    .pipe(htmlhint.failReporter())
})

function jsbeautifyHtmlFormatter () {
  var options = fs.readFileSync('.jsbeautifyrc', 'utf8')
  options = JSON.parse(stripJsonComments(options))
  return function (content) {
    return beautifyHtml(content, options.html)
  }
}

gulp.task('lint-html-format', function () {
  return gulp.src(htmlSrc)
    .pipe(checkFormat('js-beautify-lint', jsbeautifyHtmlFormatter()))
})

gulp.task('format-html', function () {
  return gulp.src('src/**/*.html')
    .pipe(format('js-beautify', jsbeautifyHtmlFormatter()))
    .pipe(gulp.dest('src'))
})

gulp.task('connect', function () {
  process.env.NO_CLUSTER = true
  require('./')
})

gulp.task('watch', [
  'debug',
  'default'
], function () {
  function watchAndStart (src, task) {
    return watch(src, function (files, cb) {
      gulp.start(task)
      cb()
    })
  }
  watchAndStart(['src/**/*.scss'], 'app-css')
  watchAndStart(templateCacheSrc.concat(appJsSrc), 'app-js')
  watchAndStart(templateWorkerJsSrc, 'template-worker-js')
})

gulp.task('debug', function () {
  isDebug = true
})

function buildJs (srcStream, dest) {
  if (isDebug) {
    srcStream = srcStream
      .pipe(sourcemaps.init())
      .pipe(concat(dest, {
        newLine: ';'
      }))
      .pipe(sourcemaps.write('.'))
  } else {
    srcStream = srcStream
      .pipe(size({
        // showFiles: true
      }))
      .pipe(ngAnnotate())
      .pipe(uglify())
      .pipe(concat(dest, {
        newLine: ';'
      }))
  }
  return srcStream.pipe(gulp.dest('public'))
}

function buildCss (srcStream, dest) {
  if (isDebug) {
    srcStream = srcStream
      .pipe(sourcemaps.init())
      .pipe(sass({
        includePaths: bourbon.includePaths.concat('src/styles')
      }))
      .pipe(concat(dest))
      .pipe(sourcemaps.write('.'))
  } else {
    srcStream = srcStream
      .pipe(sass({
        includePaths: bourbon.includePaths.concat('src/styles'),
        outputStyle: 'compressed'
      }))
      .pipe(concat(dest))
  }
  return srcStream.pipe(gulp.dest('public'))
}

function checkFormat (pluginName, format) {
  var errorCount = 0
  return through2.obj(function (file, enc, cb) {
    if (file.isNull()) {
      return cb(null, file)
    }

    if (file.isStream()) {
      cb(new util.PluginError(pluginName, 'Streaming not supported!'))
    }

    var content = String(file.contents)
    if (content !== format(content)) {
      var filename = path.relative(file.cwd, file.path)
      util.log(util.colors.red(pluginName + ': ' + filename))
      errorCount++
    }
    cb()
  }, function (cb) {
    var err = errorCount ? new util.PluginError(pluginName, util.colors.red(errorCount + ' file(s) not formatted with ' + pluginName)) : undefined
    cb(err)
  })
}

function format (pluginName, format) {
  return through2.obj(function (file, enc, cb) {
    if (file.isNull()) {
      return cb(null, file)
    }

    if (file.isStream()) {
      cb(new util.PluginError(pluginName, 'Streaming not supported!'))
    }

    file.contents = new Buffer(format(String(file.contents)))
    cb(null, file)
  })
}
