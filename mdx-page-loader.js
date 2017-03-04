const url = require('url')
const path = require('path')
const loaderUtils = require('loader-utils')
const frontMatter = require('front-matter')
const mdAnchor = require('markdown-it-anchor')
const Prism = require('prismjs')
const MDXIt = require('mdx-it')
const { loadPageWithContent } = require('sitepack/lib/loaderUtils')


const env = {};


const aliases = {
  'js': 'jsx',
  'html': 'markup'
}
function highlight(str, lang) {
  if (!lang) {
    return str
  } else {
    lang = aliases[lang] || lang
    require(`prismjs/components/prism-${lang}.js`)
    if (Prism.languages[lang]) {
      return Prism.highlight(str, Prism.languages[lang])
    } else {
      return str
    }
  }
}


function mdTitleExtractor(md) {
  md.core.ruler.push('titleExtractor', state => {
    const tokens = state.tokens

    let i = tokens.findIndex(token => token.type === 'heading_open')
    if (i !== -1) {
      let token
      do {
        token = tokens[i]
        tokens.splice(i, 1)
        if (token.type === 'inline') {
          env.title = token.content
        }
      } while (token.type !== 'heading_close')
    }
  })
}

function mdImageReplacer(md) {
  md.core.ruler.push('imageReplacer', function(state) {
    function applyFilterToTokenHierarchy(token) {
      if (token.children) {
        token.children.map(applyFilterToTokenHierarchy);
      }

      if (token.type === 'image') {
        const src = token.attrGet('src')

        if(!loaderUtils.isUrlRequest(src)) return;

        const uri = url.parse(src);
        uri.hash = null;
        token.attrSet('src', { __jsx: 'require("'+uri.format()+'")' });
      }
    }

    state.tokens.map(applyFilterToTokenHierarchy);
  })
}

function mdLinkReplacer(sitepackRoot, resourcePath) {
  return (md) => {
    md.core.ruler.push('linkReplacer', function(state) {
      function applyFilterToTokenHierarchy(token) {
        if (token.children) {
          token.children.map(applyFilterToTokenHierarchy);
        }

        if (token.type === 'link_open') {
          const href = token.attrGet('href');

          if (href.indexOf('://') !== -1 || href[0] == '#') return;

          const absoluteHref =
            href[0] === '/'
              ? href
              : '/' + path.relative(sitepackRoot, path.join(resourcePath, '..', href))

          token.attrSet('href', absoluteHref);
        }
      }

      state.tokens.map(applyFilterToTokenHierarchy);
    })
  }
}


module.exports = function markdownLoader(content) {
  const loaderOptions = loaderUtils.getOptions(this);

  if (loaderOptions.linkify === undefined) loaderOptions.linkify = true;
  if (loaderOptions.typographer === undefined) loaderOptions.typographer = true;
  if (loaderOptions.highlight === undefined) loaderOptions.highlight = highlight;

  let md =
    new MDXIt(loaderOptions)
      .enable(['link'])
      .use(mdImageReplacer)
      .use(mdLinkReplacer(loaderOptions.sitepack.packageRoot, this.resourcePath))
      .use(mdAnchor);

  if (loaderOptions.extractTitle) {
    md = md.use(mdTitleExtractor)
  }

  const data = frontMatter(content);
  const body = md.render(data.body, env);

  // Pass metadata to Sitepack by setting it on the loader's `value`
  const options = data.attributes
  if (!options.title) {
    options.title = env.title 
  }

  return loadPageWithContent(this, options, body)
}
