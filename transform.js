var React = require('react')
var Sitepack = require('sitepack')

var isContentGetter = Sitepack.isContentGetter
var createContentGetter = Sitepack.createContentGetter


module.exports = function convertMDXLinkPaths(pattern) {
  if (!(pattern instanceof RegExp)) {
    throw new Error(`Expected argument to convertMDXLinkPaths to be a RegExp. Instead received "${pattern}".`)
  }

  return function (site) {
    function getSiteHref(page, href) {
      if (href && href.indexOf('://') === -1 && href[0] !== '#') {
        var split = href.split('#')
        var id = split[0]
        var hash = split[1]
        var linkedPage = site.pages[id]
        if (linkedPage) {
          var newHref = linkedPage.absolutePath
          if (hash) newHref += '#'+hash
          return newHref
        }
        else {
          console.warn(`Link "${id}" from markdown file "${page.id}" was a 404!`)
          return '#'
        }
      }
      else {
        return href
      }
    }

    function convertLinks(page, component) {
      return function MDXDocument(props) {
        var factories = props.factories || {}

        var a = factories.a || React.createFactory('a')

        return component({
          factories: {
            a: function (props, children) {
              var href = getSiteHref(page, props.href)
              return a(Object.assign({}, props, { href: href }), children)
            }
          }
        })
      }
    }

    return site.map(function (page) {
      if (!pattern.test(page.id)) {
        return page
      }

      var originalContent = page.content
      var overrideContent =
        isContentGetter(originalContent)
          ? createContentGetter(function() { return originalContent().then((content) => convertLinks(page, content)) })
          : convertLinks(page, originalContent)
      
      return page.override({ content: overrideContent })
    })
  }
}
