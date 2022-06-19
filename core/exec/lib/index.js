'use strict';
const path = require('path');
const cp = require('child_process');
const log = require('@man-cli-dev/log')
const Package = require('@man-cli-dev/package');

const SETTINGS = {
  init: '@imooc-cli/init' // 测试使用imooc-cli，不然npm上不一定已发布@man-cli-dev/init
}
const CACHE_DIR = 'dependencies';

async function exec() {
  let targetPath = process.env.CLI_TARGET_PATH;

  let storeDir = '';
  const homePath = process.env.CLI_HOME_PATH;     // 来源core\cli\lib\index.js中的createDefaultConfig()
  log.verbose('targetPath', targetPath)
  log.verbose('homePath', homePath)

  const command = arguments[arguments.length - 1];    // 这里为什么要通过arguments而不是直接从exec函数参数中去拿command这个参数？因为action中的参数数量是不固定的，在action之前有可能调用command、description、argument、option，它们都会加入到action的参数中。但最后一个参数一定是代表的命令对象自身
  const cmdName = command.name();
  const packageName = SETTINGS[cmdName];  // 这里将命令名当做package名，要注意这个思路
  const packageVersion = 'latest';
  let pkg;
  if (!targetPath) {
    targetPath = path.resolve(homePath, CACHE_DIR);   // 如果init命令中没有携带-tp就以 用户主目录+dependencies
    storeDir = path.resolve(targetPath, 'node_modules');

    pkg = new Package({
      targetPath,
      storeDir,
      packageName,
      packageVersion
    })
    // 判断呢是否真实存在storeDir或targetPath代表的目录，如果存在，则走更新路线，如果不存在则直接去install
    if (await pkg.exists()) {
      await pkg.update();
    } else {
      await pkg.install();
    }
  } else {
    pkg = new Package({
      targetPath,
      packageName,
      packageVersion
    })
  }
  const rootFile = pkg.getRootFilePath();
  if (rootFile) {
    try {
      // require(rootFile).call(null, Array.from(arguments))
      const args = Array.from(arguments);
      // const cmd = args[args.length - 1]
      // const o = {};  // 创建一个没有原型的对象，同样是为了瘦身，原型链的一切都不要
      // Object.keys(cmd).forEach(key => {
      //   if (!key.startsWith('_') && key !== 'parent') {      // 只拿出属于对象后天属性，原型链的排除。职只为瘦身。
      //     o[key] = cmd[key];
      //   }
      // })
      // args[args.length - 1] = cmd;
      delete args[args.length - 1].parent;    // 适度去除无用的属性
      const code = `require('${rootFile}')(${JSON.stringify(args)})`;
      const child = spawn('node', ['-e', code], {
        // shell: true,   // 这里不能带否则出错
        stdio: 'inherit'
      })

      child.on('error', e => {
        log.error(e.message);
      })
      child.on('exit', e => {
        log.verbose('执行结束：' + e);
      })
    } catch (error) {
      log.error(error.message);
    }
  } else {
    log.error('没有可执行文件');
  }
}
// windows上执行的 spawn('cmd', ['/c', 'node', '-e', code], {})
function spawn(command, args, options) {
  const win32 = process.platform === 'win32';   // 获取当前系统是否Windows
  const cmd = win32 ? 'cmd' : command;
  const cmdArgs = win32 ? ['/c'].concat(command, args) : args;
  return cp.spawn(cmd, cmdArgs, options || {});
}

module.exports = exec;
