const path = require('path');

module.exports = {
    entry: './server.ts',
    externals:{
        'koa-router':'commonjs2 koa-router',
        'vary':'commonjs2 vary'
    },
    module: {
        rules: [
            {
                test: /\.tsx?$/,
                use: [
                    {
                        loader: 'ts-loader',
                        options: {
                            configFile: "tsconfig.server.json"
                        }
                    }],
                exclude: /node_modules/,
            },
        ],
    },
    resolve: {
        extensions: ['.ts', '.tsx'],
    },
    target: 'node',
    output: {
        filename: 'bundle.js',
        path: path.resolve(__dirname, 'build'),
    },
};
