import { makeStyles, shorthands, Title3, Text, Card, CardHeader, Link } from "@fluentui/react-components"

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
  infoRow: {
    display: "flex",
    ...shorthands.gap("8px"),
    marginBottom: "8px",
  },
  label: {
    fontWeight: "600",
    minWidth: "120px",
  },
})

const AboutSettings = () => {
  const styles = useStyles()

  return (
    <div className={styles.root}>
      <div className={styles.section}>
        <Title3>About Roo Code</Title3>
        <Text>Information about the extension.</Text>
        <Card className={styles.card}>
          <CardHeader header="Version Information" />
          <div style={{ padding: "16px" }}>
            <div className={styles.infoRow}>
              <Text className={styles.label}>Version:</Text>
              <Text>3.11.12</Text>
            </div>
            <div className={styles.infoRow}>
              <Text className={styles.label}>Build Date:</Text>
              <Text>April 11, 2025</Text>
            </div>
            <div className={styles.infoRow}>
              <Text className={styles.label}>Documentation:</Text>
              <Link href="https://github.com/Roo-Code/roo-code" target="_blank">
                GitHub Repository
              </Link>
            </div>
          </div>
        </Card>
      </div>

      <div className={styles.section}>
        <Title3>Telemetry Settings</Title3>
        <Text>Configure telemetry preferences.</Text>
        <Card className={styles.card}>
          <CardHeader header="Telemetry" />
          <div style={{ padding: "16px" }}>
            <Text>Telemetry settings will be implemented here.</Text>
          </div>
        </Card>
      </div>
    </div>
  )
}

export default AboutSettings
