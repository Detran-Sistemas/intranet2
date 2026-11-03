<template lang="pug">
v-dialog(
  :value='value'
  @input='$emit("input", $event)'
  max-width='480'
)
  v-card.rounded-xl.overflow-hidden
    v-card-title.py-3.px-5.grey.lighten-4.d-flex.align-center.justify-space-between
      .d-flex.align-center
        v-icon.mr-2(color='#1b6535') mdi-image-plus
        span.text-subtitle-2.font-weight-bold Inserir Imagem
      v-btn(icon, x-small, @click='$emit("input", false)')
        v-icon mdi-close

    v-card-text.pt-4.px-5
      v-tabs.mb-4(v-model='activeTab', grow, color='#1b6535')
        v-tab.caption Por URL
        v-tab.caption Upload de Arquivo

      v-tabs-items(v-model='activeTab')
        //- Aba 1: URL
        v-tab-item
          v-text-field(
            v-model='imageUrl'
            label='URL da imagem'
            placeholder='https://... ou /assets/img/...'
            outlined
            dense
            prepend-inner-icon='mdi-link'
            class='caption'
          )

        //- Aba 2: Upload
        v-tab-item
          v-file-input(
            v-model='imageFile'
            label='Selecione uma imagem'
            outlined
            dense
            accept='image/*'
            prepend-inner-icon='mdi-cloud-upload'
            class='caption'
          )

      v-text-field(
        v-model='imageAlt'
        label='Legenda / Texto alternativo'
        placeholder='Descrição da imagem...'
        outlined
        dense
        class='caption'
      )

      //- Pré-visualização se houver URL ou arquivo
      .image-preview.rounded-lg.grey.lighten-4.pa-2.text-center(v-if='previewSrc')
        img(:src='previewSrc', style='max-height: 180px; max-width: 100%; border-radius: 6px;')

    v-divider

    v-card-actions.py-2.px-5.grey.lighten-4.d-flex.justify-end
      v-btn(text, @click='$emit("input", false)', class='caption') Cancelar
      v-btn(
        depressed
        color='#1b6535'
        dark
        class='caption font-weight-bold'
        :disabled='!canInsert'
        @click='onInsert'
      ) Inserir Imagem
</template>

<script>
import { canInsertMedia, resolveMediaUpload } from './utils/editor-controller'

export default {
  name: 'MediaUploadModal',
  props: {
    value: {
      type: Boolean,
      default: false
    }
  },
  data () {
    return {
      activeTab: 0,
      imageUrl: '',
      imageFile: null,
      imageAlt: '',
      previewFileUrl: ''
    }
  },
  computed: {
    previewSrc () {
      if (this.activeTab === 0) return this.imageUrl
      return this.previewFileUrl
    },
    canInsert () {
      return canInsertMedia({
        activeTab: this.activeTab,
        imageUrl: this.imageUrl,
        imageFile: this.imageFile
      })
    }
  },
  watch: {
    imageFile (newFile) {
      if (newFile) {
        this.previewFileUrl = URL.createObjectURL(newFile)
      } else {
        this.previewFileUrl = ''
      }
    }
  },
  methods: {
    async onInsert () {
      const payload = await resolveMediaUpload({
        activeTab: this.activeTab,
        imageUrl: this.imageUrl,
        imageFile: this.imageFile,
        imageAlt: this.imageAlt
      })

      this.$emit('insert', payload)

      this.imageUrl = ''
      this.imageFile = null
      this.imageAlt = ''
      this.$emit('input', false)
    }
  }
}
</script>

<style lang="scss" scoped>
.image-preview {
  border: 1px dashed #cbd5e1;
}
</style>
