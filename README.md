# Classeur frontend

[![Build Status](https://img.shields.io/travis/classeur/classeur.svg?style=flat)](https://travis-ci.org/classeur/classeur) [![NPM version](https://img.shields.io/npm/v/classeur.svg?style=flat)](https://www.npmjs.org/package/classeur)
[![js-standard-style](https://img.shields.io/badge/code%20style-standard-brightgreen.svg)](http://standardjs.com/)

This is the frontend application as used in [Classeur](https://app.classeur.io). The application was made possible thanks to these libraries:

- [AngularJS](https://github.com/angular/angular.js)
- [Markdown It](https://github.com/markdown-it/markdown-it)
- [Prism](https://github.com/PrismJS/prism)

The [cledit library](https://github.com/classeur/cledit) developed by the Classeur team is also an important part of the project.


## Get started

### Install

```sh
npm install
```

### Start

```sh
npm start
```

Classeur works with a back-end in order to provide connected features such as synchronization, sharing and collaboration. Please refer to the [enterprise documentation](http://classeur.io/help/enterprise/) for a full installation of Classeur.


## Contributing

### Code format

Code format is checked via the command `npm run lint-all` ensuring JS, HTML and SCSS files are formatted according to the following rules:

- JavaScript: [standard style](http://standardjs.com/)
- SCSS linted with [scss-lint](https://github.com/brigade/scss-lint)
- SCSS formatted with [CSScomb](http://csscomb.com/)
- HTML linted with [HTMLHint](http://htmlhint.com/)
- HTML formatted with [JS Beautifier](http://jsbeautifier.org/)


### Style Guide

#### Naming convention

Classeur uses [hyphenated BEM](http://csswizardry.com/2013/01/mindbemding-getting-your-head-round-bem-syntax/) as a naming convention for CSS classes.

## License

[Apache](https://github.com/classeur/classeur/blob/master/LICENSE)
