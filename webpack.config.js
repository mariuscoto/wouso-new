module.exports = {
  entry: './node_modules/wouso-foundation/components/qotd.jsx',
  output: {
    filename: './node_modules/wouso-foundation/js/bundle.js'
  },
  module: {
    loaders: [{
      //tell webpack to use jsx-loader for all *.jsx files
      test: /\.jsx$/,
      loader: 'jsx-loader',
      exclude: /node_modules/
    },
    {
      //tell webpack to use jsx-loader for all *.jsx files
      test: /\.json$/,
      loader: 'json-loader',
      exclude: /node_modules/,
    }]
  },
  resolve: {
    extensions: ['', '.js', '.jsx']
  }
}