import fs from 'fs'
import chalk from 'chalk'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

function resolve(dir) {
    return path.join(__dirname, dir)
}

Date.prototype.format = function (fmt) {
    let o = {
        'M+': this.getMonth() + 1, // 月份
        'd+': this.getDate(), // 日
        'h+': this.getHours(), // 小时
        'm+': this.getMinutes(), // 分
        's+': this.getSeconds(), // 秒
        'q+': Math.floor((this.getMonth() + 3) / 3), // 季度
        S: this.getMilliseconds() // 毫秒
    }
    if (/(y+)/.test(fmt)) {
        fmt = fmt.replace(RegExp.$1, (this.getFullYear() + '').substr(4 - RegExp.$1.length))
    }
    for (var k in o) {
        if (new RegExp('(' + k + ')').test(fmt)) {
            fmt = fmt.replace(RegExp.$1, RegExp.$1.length === 1 ? o[k] : ('00' + o[k]).substr(('' + o[k]).length))
        }
    }
    return fmt
}

// 导出的文件目录位置
const SQL_PATH = resolve('./menu.sql')
let appid = ''
function createSQL(data, name = '', pid = '', arr = []) {
    data.forEach(function (v, d) {
        // var uuid = createUuid(32)
        if (v.children && v.children.length) {
            createSQL(v.children, name + '-' + v.name, v.id, arr)
        }
        arr.push({
            id: v.id,
            app_id: appid,
            created_at: new Date().format('yyyy-MM-dd hh:mm:ss'),
            modified_at: new Date().format('yyyy-MM-dd hh:mm:ss'),
            created_by: 'levy',
            modified_by: 'levy.li',
            version: 0,
            is_delete: 0,
            code: (name + '-' + v.name).slice(1),
            name: v.name,
            title: v.title,
            icon: v.icon,
            uri: v.uri,
            sort: d + 1,
            parent_id: pid,
            type: v.type,
            has_data_scope: v.hasDataScope,
            component_path: v.componentPath,
            component_name: v.componentName,
            redirect_uri: v.redirectUri,
            full_screen: v.fullScreen,
            hidden: v.hidden
        })
    })
    return arr
}

const npm_config_page = 'mirco-mp'

fs.readFile(resolve(`config/menu.json`), 'utf-8', (err, data) => {
    const menuJson = JSON.parse(data)
    appid = menuJson[0].id
    const menuList = createSQL(menuJson)
    const sql = menuList
        .map(sql => {
            let value = ''
            // eslint-disable-next-line no-unused-vars
            for (const [k, v] of Object.entries(sql)) {
                value += ','
                /* if (typeof v === 'boolean') {
                    value += v ? 1 : 0
                } else {
                    value += v ? `'${v}'` : null
                } */
                if (v === 'TRUE') {
                    value += 1
                } else if (v === 'FALSE') {
                    value += 0
                } else {
                    value += v ? `'${v}'` : null
                }
            }
            return '(' + value.slice(1) + ')'
        })
        .join(',\n')
    const mySQL =
        `delete from t_sc_resource_info where resource_code like '${npm_config_page}%';` +
        '\n' +
        'INSERT INTO `t_sc_resource_info` (`id`,`app_id`, `created_at`, `modified_at`, `created_by`, `modified_by`, `version`, `is_delete`, `resource_code`, `resource_name`, `resource_title`, `icon`, `uri`, `sort_index`, `pid`, `resource_type`, `has_data_scope`, `component_path`, `component_name`, `redirect_uri`, `full_screen`, `hidden`) VALUES ' +
        '\n' +
        sql
    fs.writeFile(SQL_PATH, mySQL, err => {
        if (err) return console.log(err)
        console.log(chalk.cyanBright(`恭喜你，创建sql语句成功，位置：${SQL_PATH}`))
    })
})
