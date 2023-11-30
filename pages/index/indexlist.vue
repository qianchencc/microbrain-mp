<template>
	<view class="active">
		<m-indexlist :data="geospatialInfo" @select-item='selectHandler' @confirm="contactsConfirm" @cancel="cancel">
		</m-indexlist>
	</view>
</template>

<script setup>
import {
    ref,
    computed
} from 'vue'
import {
    useUserStoreHook
} from '@/store/modules/user'

const geospatialInfo = computed(() => useUserStoreHook().getGeospatialInfo)

const geospatial = ref(null)
const selectHandler = (e) => {
    geospatialInfo.value.map(val => {
        if(val.id !== e.id) {
            val.choose = false
        }
    })
    geospatial.value = e
}
const contactsConfirm = (res) => {
    if(geospatial.value) {
        useUserStoreHook().SET_DISTRICT(geospatial.value)
    }
    uni.navigateBack()
}
const cancel = () => {
    uni.navigateBack()
}
</script>

<style>
</style>
