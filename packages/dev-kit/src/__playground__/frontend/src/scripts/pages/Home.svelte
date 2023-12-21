<script lang="ts">
  import testJpg from 'images/test.jpg';
  import testSvg from 'images/test.svg';

  export let locale: Record<string, string>;
</script>

<p>
  <img alt="test" src={testJpg} />
  <img alt="test" src={testSvg} />
  {locale.LABEL_TEST}
</p>
