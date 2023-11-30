<template>
	<view class='index-list'>
		<view class='index-list__head'>
			<input v-model="citySearch" :placeholder='placeholder' class="index-list__input"
				placeholder-class="index-list__input__placeholder" />
		</view>

		<div>
			<scroll-view v-if="!isBigData" :scroll-y='true'
				:scroll-into-view='"list-archor-" + encodeURIComponent(this.currentActiveIndex).replace("%", "_")'
				class='index-list__scroller'>
				<div v-for='(list, key) in dataFiltered'
					:id='"list-archor-"+ encodeURIComponent(list.id).replace("%","_")' :key='key'>
					<div class="index-list__group-head">
						{{list.letter}}
					</div>
					<div class="index-list__group-cell" v-for='item in list.data' @click="()=>{itemClickHandler(item)}"
						:clickable='true' :key="item.id">
						<uni-icons :type="item.choose ? 'checkbox-filled' : 'circle'"
							:color="item.choose ? '#007aff' : '#aaa'" size="22" />
						<text>{{' '+item.name}}&nbsp;&nbsp;{{item.phone}}</text>
					</div>
				</div>
				<div style='height: 45px;width: 100%;'></div>
			</scroll-view>
			<div v-else class='index-list__scroller'>
				<div ref="bigDataTablePanel" class="index-list__big-data__table-panel">
					<div ref="bigDataTableBody" class="index-list__big-data__table-body">
						<div ref="bigDataTableDataPanel" class="index-list__big-data__table-data-panel">
							<div ref="bigDataTableDataMarginSpace"></div>
							<div v-for='item in bigDataFilteredFlatWithLineInfoCurrent' :key='item.id'>
								<div v-if='item.__line_info__.isEmptySpace'
									class="index-list__group-cell index-list__group-cell--empty-space"></div>
								<div v-else-if='!item.__line_info__.isEmptySpace&&item.__line_info__.isHead'
									class="index-list__group-head">{{item.name}}</div>
								<div v-else-if='!item.__line_info__.isEmptySpace&&!item.__line_info__.isHead'
									class="index-list__group-cell" @click="()=>{ itemClickHandler(item)}"
									:key="item.id">
									{{item.name}}
								</div>

							</div>
							<div v-for='(list, key) in dataFiltered' style='' :key='key'>
								<div class="index-list__group-head"
									:id='"list-archor-"+ encodeURIComponent(list.id).replace("%","_")'>
									{{list.letter}}
								</div>
								<div class="index-list__group-cell" v-for='item in list.data'
									@click="()=>{itemClickHandler(item)}" :clickable='true' :key="item.id">
									{{item.name}}
								</div>
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>

		<view v-if='useIndex&&dataFiltered&&dataFiltered.length>0' class='index-list__index'
			@touchmove="indexTouchMoveHandler" @touchstart="indexTouchMoveHandler" @touchend="isZoomActiveIndex=false">
			<div class='index-list__index__wrapper'>
				<div v-for='(list, key) in dataFiltered' :key='key' class='index-list__index__letter'
					:class='{"index-list__index__letter--active":currentActiveIndex===list.letter&&isZoomActiveIndex}'>
					{{list.letter}}
				</div>
			</div>
		</view>
		<view class="contact-button-groups">
			<button class="contact-button" type="default" @click="cancel">取消</button>
			<button class="contact-button primary" type="primary" @click="confirm">确定</button>
		</view>
	</view>
</template>

<script>
var alphabet = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T',
    'U', 'V', 'W', 'X', 'Y', 'Z'
]
import pinyin from './pinyin.js'
export default {
    name: 'missthee-indexlist',
    props: {
        data: {
            type: Array,
            default: function() {
                return []
            }
        },
        placeholder: {
            type: String,
            default: function() {
                return '输入关键字查询'
            }
        },
        useIndex: {
            type: Boolean,
            default: function() {
                return true
            }
        },
        isBigData: {
            type: Boolean,
            default: function() {
                return false
            }
        }
    },
    data() {
        return {
            dataFiltered: {},
            currentActiveIndex: '',
            isZoomActiveIndex: false,
            citySearch: '',
            citySeatchDebounce: null,
            bigDataFilteredLineHeightTotal: 0,
            bigDataFiltered: {},
            bigDataFilteredFlatWithLineInfo: [],
            bigDataFilteredFlatWithLineInfoCurrent: [],
            bigDataTableDataPanelEl: null,
            bigDataTableDataMarginSpaceEl: null,
            bigDataParam: {
                scrollHeight: 0,
                dataHeadHeight: 35, // 索引行高
                dataRowHeight: 45 // 数据行高
            },
            bigDataComputedParam: {
                dataRowTopMax: 0, // 数据行滑到底，移动的最大距离
                dataRowTop: 0 // 数据行当前移动的距离
            },

            bigDataScrollActionParam: {
                speed: 0,
                speedMax: 50,
                resistance: 0.5,
                prePositionY: null,
                preTimestamp: null,
                isMouseDown: false,
                timeoutObj: null
            }
        }
    },
    watch: {
        data: {
            immediate: true,
            handler() {
                this.buildDataFiltered()
            }
        },
        citySearch() {
            if (this.citySeatchDebounce) {
                clearTimeout(this.citySeatchDebounce)
                this.citySeatchDebounce = null
            }
            this.citySeatchDebounce = setTimeout(() => {
                this.buildDataFiltered()
            }, 200)
        },
        dataFiltered: {
            deep: true,
            handler() {
                if (this.isBigData) {
                    this.bigDataComputedParam.dataRowTop = 0
                    this.bigDataBuildData()
                    this.bigDataUpdateRows()
                }
            }
        }
    },
    mounted() {
        if (this.isBigData) {
            this.bigDataTableDataPanelEl = this.$refs.bigDataTableDataPanel
            this.bigDataTableDataMarginSpaceEl = this.$refs.bigDataTableDataMarginSpace
            this.bigDataParam.scrollHeight = this.bigDataTableDataPanelEl.offsetHeight
            this.bigDataAddEvent()
            this.bigDataBuildData()
            this.bigDataUpdateRows()
            this.bigDataScrollAminate()
        }
    },
    beforeDestroy() {
        if (this.isBigData) {
            this.bigDataClearScrollAnimate()
            this.bigDataRemoveEvent()
        }
    },
    methods: {
        indexTouchMoveHandler(e) {
            this.isZoomActiveIndex = true
            const touch = e.touches[0]
            const target = e.currentTarget || e.target
            let currentIndex = Math.floor((touch.clientY + this.dataFiltered.length * 15 / 2 -
					target.offsetTop) / 15)
            currentIndex = Math.min(this.dataFiltered.length - 1, currentIndex)
            currentIndex = Math.max(0, currentIndex)
            if (this.dataFiltered[currentIndex].letter !== this.currentActiveIndex) {
                this.currentActiveIndex = this.dataFiltered[currentIndex].letter
                if (this.isBigData) {
                    const currentStartLine = this.bigDataFilteredFlatWithLineInfo.find(item => item.id === 'Head:' +
							this.currentActiveIndex)
                    this.bigDataComputedParam.dataRowTop = currentStartLine.__line_info__.totalHeight -
							currentStartLine.__line_info__.currentHeight
                    this.bigDataUpdateRows()
                }
            }
            if (typeof event !== 'undefined') {
                event.preventDefault()
                event.stopPropagation()
            }
        },
        itemClickHandler(item) {
            const result = {
                ...item
            }
            for (const key of Object.keys(result)) {
                if (key === '__line_info__') {
                    delete result[key]
                }
            }
            item.choose = !item.choose
            this.$emit('select-item', item)
        },
        buildDataFiltered() {
            if (!this.data) return {}
            const unsorted = this.getModel()
            this.data.forEach(contact => {
                let firstChar = ''
                contact.name = contact.name ? contact.name.trim() : ''
                if (contact.name) { // 如传入空字符串，getCamelFistChar错误地返回Y
                    firstChar = pinyin.getCamelFistChar(contact.name)
                        .toUpperCase() // 如字母开头，将返回字母且保留原大小写;一律改为大写
                }
                const hashIndex = alphabet.indexOf('#')
                let index = alphabet.indexOf(firstChar)
                index = index === -1 ? hashIndex : index
                unsorted[index].data.push(contact)
            })
            // 只保留有数据的list
            const sorted = []
            unsorted.forEach(item => {
                item.data = item.data.filter(e => e.name.toLowerCase().indexOf(this.citySearch
                    .toLowerCase()) >= 0)
                if (item.data.length > 0) {
                    // 按姓名拼音排序
                    item.data.sort((a, b) => a.name.localeCompare(b.name,
                        'zh')) // name 不能为 null，否则localCompare 将报错
                    sorted.push(item)
                }
            })
            this.dataFiltered = sorted
        },
        getModel() {
            const model = []
            alphabet.forEach(letter => {
                model.push({
                    'letter': letter,
                    'data': [],
                    id: letter === '#' ? 'hash' : letter
                })
            })
            return model
        },
        confirm() {
            this.$emit('confirm')
        },
        cancel() {
            this.$emit('cancel')
        },
        bigDataAddEvent() {
            this.bigDataTableDataPanelEl.addEventListener('mousewheel', this.bigDataScrollEvent)
            this.bigDataTableDataPanelEl.addEventListener('touchmove', this.bigDataScrollEvent)
            this.bigDataTableDataPanelEl.addEventListener('touchstart', this.bigDataTouchStartEvent)
            this.bigDataTableDataPanelEl.addEventListener('touchend', this.bigDataTouchEndEvent)
        },
        bigDataRemoveEvent() {
            this.bigDataTableDataPanelEl.removeEventListener('mousewheel', this.bigDataScrollEvent)
            this.bigDataTableDataPanelEl.removeEventListener('touchmove', this.bigDataScrollEvent)
            this.bigDataTableDataPanelEl.removeEventListener('touchstart', this.bigDataTouchStartEvent)
            this.bigDataTableDataPanelEl.removeEventListener('touchend', this.bigDataTouchEndEvent)
        },
        bigDataTouchStartEvent(e) {
            this.bigDataScrollActionParam.isMouseDown = true
            this.bigDataScrollActionParam.speed = 0
        },
        bigDataTouchEndEvent(e) {
            this.bigDataScrollActionParam.isMouseDown = false
            this.bigDataScrollActionParam.prePositionY = null
        },
        bigDataScrollEvent(e) {
            const scrollEvent = e
            if (scrollEvent instanceof WheelEvent) {
                this.bigDataComputedParam.dataRowTop += (scrollEvent.wheelDelta < 0 ? 1 : -1) * 30
                if (this.bigDataComputedParam.dataRowTop <= 0) {
                    this.bigDataComputedParam.dataRowTop = 0 // 滑块最多滑到顶部
                } else if (this.bigDataComputedParam.dataRowTop >= this.bigDataComputedParam.dataRowTopMax) {
                    this.bigDataComputedParam.dataRowTop = this.bigDataComputedParam.dataRowTopMax // 滑块最多滑到最底部
                } else {
                    e.preventDefault() // 禁用滑轮滚动默认事件。当表格滑动到边缘时再启用默认滚动事件
                }
            } else if (scrollEvent instanceof TouchEvent) {
                if (this.bigDataScrollActionParam.isMouseDown) {
                    const positionY = scrollEvent.changedTouches[0].screenY
                    const timeStamp = scrollEvent.timeStamp
                    let step = 0
                    this.bigDataScrollActionParam.prePositionY = this.bigDataScrollActionParam.prePositionY ||
							positionY
                    this.bigDataScrollActionParam.preTimeStamp = this.bigDataScrollActionParam.preTimeStamp ||
							timeStamp
                    const timeDuration = timeStamp - this.bigDataScrollActionParam.preTimeStamp
                    let velocity
                    if (timeDuration === 0) {
                        velocity = 0
                    } else {
                        velocity = (positionY - this.bigDataScrollActionParam.prePositionY) / timeDuration
                    }
                    if (this.bigDataScrollActionParam.prePositionY !== null) {
                        step = positionY - this.bigDataScrollActionParam.prePositionY
                        this.bigDataComputedParam.dataRowTop -= step
                    }
                    this.bigDataScrollActionParam.prePositionY = positionY
                    this.bigDataScrollActionParam.preTimeStamp = timeStamp
                    this.bigDataScrollActionParam.speed = velocity * 16
                    event.preventDefault()
                    event.stopPropagation()
                }
            }
            this.bigDataUpdateRows()
        },
        bigDataBuildData() {
            this.bigDataFilteredFlatWithLineInfo = []
            this.bigDataFilteredLineHeightTotal = 0
            for (const key of Object.keys(this.dataFiltered)) {
                if (this.dataFiltered[key] && this.dataFiltered[key].length > 0) {
                    this.bigDataFilteredLineHeightTotal += this.bigDataParam.dataHeadHeight
                    this.bigDataFilteredFlatWithLineInfo.push({
                        id: 'Head:' + key,
                        name: key,
                        __line_info__: {
                            isEmptySpace: false,
                            isHead: true,
                            currentHeight: this.bigDataParam.dataHeadHeight,
                            totalHeight: this.bigDataFilteredLineHeightTotal
                        }
                    })
                    this.dataFiltered[key].forEach((item) => {
                        this.bigDataFilteredLineHeightTotal += this.bigDataParam.dataRowHeight
                        this.bigDataFilteredFlatWithLineInfo.push({
                            id: 'Row:' + item.id,
                            name: item.name,
                            __line_info__: {
                                isEmptySpace: false,
                                isHead: false,
                                currentHeight: this.bigDataParam.dataRowHeight,
                                totalHeight: this.bigDataFilteredLineHeightTotal
                            }
                        })
                    })
                }
            }
            this.bigDataFilteredLineHeightTotal += this.bigDataParam.dataRowHeight
            this.bigDataFilteredFlatWithLineInfo.push({
                id: 'EmptyFooter',
                name: '',
                __line_info__: {
                    isEmptySpace: true,
                    isHead: false,
                    currentHeight: this.bigDataParam.dataRowHeight,
                    totalHeight: this.bigDataFilteredLineHeightTotal
                }
            })
            // 计算出数据区域滑动到最后一条数据，所需要的位移距离
            this.bigDataComputedParam.dataRowTopMax = Math.max(this.bigDataFilteredLineHeightTotal - this.bigDataParam
                .scrollHeight, 0)
        },
        bigDataUpdateRows() {
            this.bigDataComputedParam.dataRowTop = Math.max(0, this.bigDataComputedParam.dataRowTop)
            this.bigDataComputedParam.dataRowTop = Math.min(this.bigDataComputedParam.dataRowTop, this
                .bigDataComputedParam.dataRowTopMax)
            if (this.bigDataFilteredFlatWithLineInfo.length > 0) {
                // 更新数据区的数据，根据滚动的距离，确定可见的第一条数据下标（此方法保证可见数据行内容的更新。注释掉此方法，拖动滚动条，数据会在开始部分一直循环）
                // 遍历数据，插入窗口中可见的数据行
                let startIndex = null
                let endIndex = null

                for (let i = parseInt(this.bigDataComputedParam.dataRowTop / Math.max(this.bigDataParam.dataRowHeight,
                    this.bigDataParam.dataHeadHeight), 10) - 1; i < this.bigDataFilteredFlatWithLineInfo
                        .length; i++) {
                    if (i < 0) {
                        continue
                    }
                    const totalHeight = this.bigDataFilteredFlatWithLineInfo[i].__line_info__.totalHeight
                    if (totalHeight >= this.bigDataComputedParam.dataRowTop && startIndex === null) {
                        startIndex = i
                    }
                    if (totalHeight >= (this.bigDataComputedParam.dataRowTop + this.bigDataParam.scrollHeight) &&
							endIndex === null) {
                        endIndex = Math.min(i + 3, this.bigDataFilteredFlatWithLineInfo.length)
                    }
                    if (startIndex !== null && endIndex !== null) {
                        break
                    }
                }
                startIndex = startIndex || 0
                endIndex = endIndex || 0
                this.bigDataFilteredFlatWithLineInfoCurrent = this.bigDataFilteredFlatWithLineInfo.slice(startIndex,
                    endIndex)
                if (this.bigDataFilteredFlatWithLineInfoCurrent && this.bigDataFilteredFlatWithLineInfoCurrent[0]) {
                    const tmp = this.bigDataFilteredFlatWithLineInfoCurrent[0]
                    const firstRowHeight = tmp.__line_info__.currentHeight || 0
                    const firstRowTotalHeight = tmp.__line_info__.totalHeight || 0
                    // 数据区实现拖动滑条的位移效果（保证数据行的滚动效果，注释此方法，拖动滚动条，数据无滚动效果，但内容会更新）
                    const newMarginTop = firstRowTotalHeight - this.bigDataComputedParam.dataRowTop - firstRowHeight
                    this.bigDataTableDataMarginSpaceEl.style.marginTop = newMarginTop + 'px'
                }
            }
        },
        bigDataScrollAminate() {
            this.bigDataScrollActionParam.timeoutObj = setInterval(() => {
                if (Math.abs(this.bigDataScrollActionParam.speed) > 0 && !this.bigDataScrollActionParam
                    .isMouseDown) {
                    this.bigDataScrollActionParam.speed = (this.bigDataScrollActionParam.speed >= 0 ? 1 : -1) *
							Math.min(this.bigDataScrollActionParam.speedMax, Math.max(0, Math.abs(this
							    .bigDataScrollActionParam.speed) - this.bigDataScrollActionParam
							    .resistance))
                    this.bigDataComputedParam.dataRowTop -= this.bigDataScrollActionParam.speed
                    this.bigDataUpdateRows()
                }
            }, 16)
        },
        bigDataClearScrollAnimate() {
            if (this.bigDataScrollActionParam.timeoutObj) {
                clearInterval(this.bigDataScrollActionParam.timeoutObj)
                this.bigDataScrollActionParam.timeoutObj = null
            }
        }
    }
}
</script>

<style lang='scss' scoped>
	$uni-bg-color-grey:#f1f1f1;
	$uni-bg-color-white:#fff;
	$uni-text-color:#333;
	$uni-text-color-placeholder: #808080;
	$uni-text-color-grey:#999;
	$uni-bg-color-hover:#f1f1f1;
	/* * {
		font-family: Consolas, sans-serif;
		box-sizing: border-box !important;
		margin: 0;
		padding: 0;
	} */

	.index-list {
		position: absolute;
		top: 0;
		bottom: 0;
		width: 100%;

		&__head {
			position: absolute;
			top: 0;
			width: 100%;
			height: 50px;
			overflow: hidden;
			background-color: $uni-bg-color-white;
			/* border-bottom: 1px solid $uni-bg-color-grey; */
		}

		&__input {
			box-sizing: border-box;
			width: 90%;
			height: 30px;
			padding: 0 20px;
			margin: auto;
			height: 30px;
			margin: 10px auto;
			line-height: 30px;
			background-color: $uni-bg-color-grey;
			border-radius: 30px;
			font-size: 12px;
			color: $uni-text-color;

			&__placeholder {
				text-align: center;
				color: $uni-text-color-placeholder;
			}
		}

		&__scroller {
			position: absolute;
			top: 50px;
			bottom: 0;
			width: 100%;
			background-color: white;
			overflow-x: hidden;
			overflow-y: auto;
		}

		&__big-data {

			&__table-panel {
				height: 100%;
				width: 100%;
			}

			&__table-body {
				/*因为数据区与滚动条要使用position:absolute做成左右固定布局，table-body作为其两节点的父节点，使用position: relative*/
				position: relative;
				height: 100%;
				overflow: hidden;
				background-color: white;
			}

			&__table-data-panel {
				overflow: hidden;
				position: absolute;
				left: 0;
				/*right值宽度等于滚动条的宽度。也可不设置，但滚动条会覆盖表格的最右侧*/
				/*right: 15px;*/
				width: 100%;
				height: 100%;
			}
		}

		&__group-head {
			box-sizing: border-box;
			/* background-color: $uni-bg-color-grey; */
			color: $uni-text-color-grey;
			height: 35px;
			line-height: 45px;
			padding: 0 0 0 15px;
		}

		&__group-cell {
			box-sizing: border-box;
			/* background-color: $uni-bg-color; */
			color: $uni-text-color;
			font-size: 14px;
			font-family: SourceHanSansSC-Regular, SourceHanSansSC;
			height: 45px;
			line-height: 45px;
			padding: 0 0 0 15px;

			&:after {
				display: block;
				position: absolute;
				content: '';
				width: 100%;
				height: 1px;
				background-color: $uni-bg-color-grey;
			}

			&:active {
				background-color: $uni-bg-color-hover;
			}

			&--empty-space {
				&:active {
					background-color: white;
				}
			}

		}

		&__index {
			position: absolute;
			right: 0;
			top: 50%;
			transform: translateY(-50%);

			&__wrapper {
				width: 20px;
				margin: 0 7px 0 0;
				text-align: center;
				background-color: rgba(0, 0, 0, 0.03);
				border-radius: 10px;
				color: $uni-text-color-grey;
				padding: 10px 0;
				font-family: Consolas, sans-serif;
			}

			&__letter {
				display: block;
				height: 15px !important;
				line-height: 15px !important;
				transition: transform 0.1s;

				&--active {
					transition: none;
					font-weight: bold;
					font-size: 50px;
					transform: translateX(-70px);
				}
			}
		}
	}

	.contact-button-groups {
		text-align: center;
		margin-top: 10rpx;
		width: 750rpx;
		position: absolute;
		bottom: 0;
	}

	.contact-button {
		display: inline-block;
		width: 45%;
		margin: 0 10upx;
		font-size: 32upx;
		
		&.primary {
			background-color: #397DF6;
		}
	}
</style>
