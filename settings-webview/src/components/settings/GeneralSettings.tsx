import { makeStyles, shorthands, Title3, Text, Card, CardHeader } from "@fluentui/react-components"

const useStyles = makeStyles({
  root: {
    display: "flex",
    flexDirection: "column",
    ...shorthands.gap("16px"),
  },
  card: {
    width: "100%",
  },
  section: {
    marginBottom: "24px",
  },
})

const GeneralSettings = () => {
  const styles = useStyles()

  return (
    <div className={styles.root}>
      <div className={styles.section}>
        <Title3>API Configuration</Title3>
        <Text>Configure your API settings for different providers.</Text>
        <Card className={styles.card}>
          <CardHeader header="API Keys" />
          <div style={{ padding: "16px" }}>
            <Text>API key settings will be implemented here.</Text>
          </div>
        </Card>
      </div>

      <div className={styles.section}>
        <Title3>Language Settings</Title3>
        <Text>Configure language preferences for the extension.</Text>
        <Card className={styles.card}>
          <CardHeader header="Language" />
          <div style={{ padding: "16px" }}>
            <Text>Language settings will be implemented here.</Text>
          </div>
        </Card>
      </div>
    </div>
  )
}

export default GeneralSettings
